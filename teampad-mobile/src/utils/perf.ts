export const isLowEndProfile =
    (process.env.EXPO_PUBLIC_LOW_END_PROFILE ?? '').toLowerCase() === 'true';

type ListPerfConfig = {
    initialNumToRender: number;
    windowSize: number;
    maxToRenderPerBatch: number;
    updateCellsBatchingPeriod: number;
};

export const listPerfConfig: ListPerfConfig = isLowEndProfile
    ? {
        initialNumToRender: 6,
        windowSize: 5,
        maxToRenderPerBatch: 6,
        updateCellsBatchingPeriod: 75,
    }
    : {
        initialNumToRender: 10,
        windowSize: 9,
        maxToRenderPerBatch: 10,
        updateCellsBatchingPeriod: 50,
    };
