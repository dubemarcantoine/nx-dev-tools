export interface CleanExecutor {
    location: string;
    repository: string;
    package: string;
    /**
     * How many of the most recent images to keep.
     *
     * Kept rather than pruned to one so a bad release can be rolled back to a previous image that is
     * still in the registry -- deleting everything but the current build leaves nothing to roll back to.
     */
    keep?: number;
}
