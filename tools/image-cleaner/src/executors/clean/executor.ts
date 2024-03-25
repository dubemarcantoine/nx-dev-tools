import {CleanExecutor} from './schema';
import {logger} from "nx/src/utils/logger";
import {GoogleAuth} from "google-auth-library";

const artifactRegistryUrl = `https://artifactregistry.googleapis.com/v1beta2`;

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

    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const packageLocation = `projects/${projectId}/locations/${options.location}/repositories/${options.repository}/packages/${options.package}`;
    const tagLocation = `${packageLocation}/tags`;
    const url = `${artifactRegistryUrl}/${tagLocation}`;
    const tagsResult: any = await client.request({url});

    const latestTag = tagsResult.data.tags.find(tag => {
        if (tag.name === `${tagLocation}/latest`) {
            return tag;
        }
    });

    for (const tag of tagsResult.data.tags) {
        if (tag.version !== latestTag.version) {
            const index = tag.version.indexOf('sha256:');
            if (index > -1) {
                const version = tag.version.substring(index);

                try {
                    await client.request({
                        method: 'DELETE',
                        url: `${artifactRegistryUrl}/${packageLocation}/versions/${version}`,
                        params: {
                            force: true,
                        },
                    });
                } catch (e) {
                    logger.error(e);
                }
            }
        }
    }

    return {
        success: true,
    };
}
