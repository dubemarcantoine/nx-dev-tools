import {CleanExecutor} from './schema';
import {logger} from "nx/src/utils/logger";
import {GoogleAuth} from "google-auth-library";

const artifactRegistryUrl = `https://artifactregistry.googleapis.com/v1beta2`;

/**
 * How many images to keep when the caller does not say.
 *
 * Ten rather than one because these are what a rollback rolls back to: `kubectl rollout undo` only
 * helps if the image the previous revision names is still in the registry. Pruning to the current
 * build alone leaves a bad release with nowhere to go.
 */
const DEFAULT_KEEP = 10;

/** Artifact Registry caps page size at 1000; anything smaller just means more round trips. */
const PAGE_SIZE = 1000;

interface Version {
    name: string;
    createTime?: string;
    relatedTags?: {name?: string}[];
}

/**
 * Every version of the package, following pagination.
 *
 * FULL view so each version carries its tags, which is how the one currently tagged `latest` is
 * recognised -- that is the running image and must survive whatever the retention count says.
 */
async function listVersions(client: any, packageLocation: string): Promise<Version[]> {
    const versions: Version[] = [];
    let pageToken: string | undefined;

    do {
        const result: any = await client.request({
            url: `${artifactRegistryUrl}/${packageLocation}/versions`,
            params: {view: 'FULL', pageSize: PAGE_SIZE, pageToken},
        });

        versions.push(...(result.data.versions ?? []));
        pageToken = result.data.nextPageToken;
    } while (pageToken);

    return versions;
}

const isTagged = (version: Version, tag: string): boolean =>
    (version.relatedTags ?? []).some(related => (related.name ?? '').endsWith(`/${tag}`));

export default async function runExecutor(options: CleanExecutor) {
    if (!options.package) {
        logger.error("The `package` parameter is required");
        return {
            success: false,
        };
    }

    if (!options.location) {
        logger.error("The `location` parameter is required");
        return {
            success: false,
        };
    }

    if (!options.repository) {
        logger.error("The `repository` parameter is required");
        return {
            success: false,
        };
    }

    const keep = options.keep ?? DEFAULT_KEEP;

    if (keep < 1) {
        logger.error("The `keep` parameter must be at least 1");
        return {
            success: false,
        };
    }

    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const packageLocation = `projects/${projectId}/locations/${options.location}/repositories/${options.repository}/packages/${options.package}`;

    const versions = await listVersions(client, packageLocation);

    /*
     * Newest first, by the registry's own creation time.
     *
     * This used to walk tags and delete anything whose version differed from `latest`, which had no
     * notion of age -- so it could only ever keep one image, and untagged versions were never
     * collected at all because they have no tag to iterate over.
     */
    const newestFirst = [...versions].sort((a, b) =>
        Date.parse(b.createTime ?? '') - Date.parse(a.createTime ?? ''));

    const kept = new Set(newestFirst.slice(0, keep).map(version => version.name));

    // Whatever is serving traffic stays, even if something has pushed it out of the newest N.
    for (const version of newestFirst) {
        if (isTagged(version, 'latest')) {
            kept.add(version.name);
        }
    }

    const doomed = newestFirst.filter(version => !kept.has(version.name));

    logger.info(`Keeping ${kept.size} image(s) of ${versions.length}, deleting ${doomed.length}`);

    for (const version of doomed) {
        try {
            await client.request({
                method: 'DELETE',
                url: `${artifactRegistryUrl}/${version.name}`,
                params: {
                    force: true,
                },
            });
        } catch (e) {
            logger.error(e);
        }
    }

    return {
        success: true,
    };
}
