import runExecutor from './executor';

const request = jest.fn();

jest.mock('google-auth-library', () => ({
    GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: async () => ({request: (...args: unknown[]) => request(...args)}),
        getProjectId: async () => 'test-project',
    })),
}));

jest.mock('nx/src/utils/logger', () => ({
    logger: {info: jest.fn(), error: jest.fn()},
}));

/**
 * Deciding which images to delete.
 *
 * This runs against a live registry and its mistakes are unrecoverable, so the retention boundary is
 * pinned exactly. The failure that matters is deleting too much: an image that is gone cannot be rolled
 * back to, which is the whole reason anything is kept.
 */
describe('image-cleaner clean executor', () => {
    const options = {location: 'northamerica-northeast1', repository: 'lte-apps', package: 'backend'};

    const version = (id: string, createTime: string, tags: string[] = []) => ({
        name: `projects/test-project/locations/x/repositories/y/packages/z/versions/sha256:${id}`,
        createTime,
        relatedTags: tags.map(tag => ({name: `.../tags/${tag}`})),
    });

    /** Serves one page of versions, then records every delete. */
    const registryWith = (versions: unknown[], pages?: unknown[][]) => {
        const deleted: string[] = [];
        let page = 0;

        request.mockImplementation(async (config: any) => {
            if (config.method === 'DELETE') {
                deleted.push(config.url);
                return {data: {}};
            }

            if (pages) {
                const current = pages[page++];
                return {
                    data: {
                        versions: current,
                        nextPageToken: page < pages.length ? `page-${page}` : undefined,
                    },
                };
            }

            return {data: {versions}};
        });

        return deleted;
    };

    const idsIn = (urls: string[]) =>
        urls.map(url => url.substring(url.indexOf('sha256:') + 'sha256:'.length));

    beforeEach(() => {
        request.mockReset();
    });

    describe('required parameters', () => {
        it.each(['package', 'location', 'repository'])('refuses to run without %s', async (missing) => {
            const result = await runExecutor({...options, [missing]: undefined} as any);

            expect(result.success).toBe(false);
            expect(request).not.toHaveBeenCalled();
        });
    });

    /* Keeping nothing would delete the running image, so it is refused rather than clamped. */
    it('refuses a retention count below one', async () => {
        const result = await runExecutor({...options, keep: 0});

        expect(result.success).toBe(false);
        expect(request).not.toHaveBeenCalled();
    });

    it('keeps ten by default, so there is something to roll back to', async () => {
        const versions = Array.from({length: 15}, (_, i) =>
            version(`v${i}`, `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`));
        const deleted = registryWith(versions);

        await runExecutor(options as any);

        expect(deleted).toHaveLength(5);
    });

    it('keeps exactly the number asked for', async () => {
        const versions = Array.from({length: 10}, (_, i) =>
            version(`v${i}`, `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`));
        const deleted = registryWith(versions);

        await runExecutor({...options, keep: 3});

        expect(deleted).toHaveLength(7);
    });

    /* Newest by the registry's own creation time, not by whatever order the API returned them in. */
    it('keeps the newest and deletes the oldest', async () => {
        const deleted = registryWith([
            version('oldest', '2026-01-01T00:00:00Z'),
            version('newest', '2026-08-01T00:00:00Z'),
            version('middle', '2026-05-01T00:00:00Z'),
        ]);

        await runExecutor({...options, keep: 2});

        expect(idsIn(deleted)).toEqual(['oldest']);
    });

    it('deletes nothing when there are fewer images than it keeps', async () => {
        const deleted = registryWith([version('only', '2026-08-01T00:00:00Z')]);

        await runExecutor({...options, keep: 10});

        expect(deleted).toHaveLength(0);
    });

    it('deletes nothing from an empty registry', async () => {
        const deleted = registryWith([]);

        const result = await runExecutor(options as any);

        expect(result.success).toBe(true);
        expect(deleted).toHaveLength(0);
    });

    /*
     * The running image survives whatever its age. A build pushed with an older creation time -- a
     * rebuild of an earlier commit, say -- must not evict what is actually serving traffic.
     */
    it('never deletes the image tagged latest', async () => {
        const deleted = registryWith([
            version('new-a', '2026-08-03T00:00:00Z'),
            version('new-b', '2026-08-02T00:00:00Z'),
            version('serving', '2026-01-01T00:00:00Z', ['latest']),
        ]);

        await runExecutor({...options, keep: 2});

        expect(idsIn(deleted)).not.toContain('serving');
        expect(deleted).toHaveLength(0);
    });

    /*
     * Untagged versions are collected too. The previous implementation walked tags, so an image that
     * had lost its tag was never seen again and accumulated forever.
     */
    it('deletes untagged versions as well as tagged ones', async () => {
        const deleted = registryWith([
            version('current', '2026-08-03T00:00:00Z', ['latest']),
            version('untagged', '2026-01-01T00:00:00Z'),
        ]);

        await runExecutor({...options, keep: 1});

        expect(idsIn(deleted)).toEqual(['untagged']);
    });

    it('follows pagination rather than pruning only the first page', async () => {
        const deleted = registryWith([], [
            [version('a', '2026-08-05T00:00:00Z'), version('b', '2026-08-04T00:00:00Z')],
            [version('c', '2026-08-03T00:00:00Z'), version('d', '2026-08-02T00:00:00Z')],
        ]);

        await runExecutor({...options, keep: 1});

        expect(idsIn(deleted).sort()).toEqual(['b', 'c', 'd']);
    });

    /* One refused delete must not abandon the rest of the sweep. */
    it('carries on when a delete fails', async () => {
        let calls = 0;

        request.mockImplementation(async (config: any) => {
            if (config.method === 'DELETE') {
                calls += 1;
                if (calls === 1) {
                    throw new Error('permission denied');
                }
                return {data: {}};
            }

            return {
                data: {
                    versions: [
                        version('keep', '2026-08-05T00:00:00Z'),
                        version('old-a', '2026-02-01T00:00:00Z'),
                        version('old-b', '2026-01-01T00:00:00Z'),
                    ],
                },
            };
        });

        const result = await runExecutor({...options, keep: 1});

        expect(result.success).toBe(true);
        expect(calls).toBe(2);
    });
});
