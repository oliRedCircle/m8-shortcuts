/**
 * Global animation configuration
 * Controls the timing for timeline playhead and keypress animations
 */
export const animation = {
    /** 
     * Duration of the complete animation cycle in milliseconds
     * This controls both the timeline playhead sweep and button lighting
     */
    duration: 1500, // 2 seconds

    /**
     * Duration in CSS format (for use in CSS animations)
     */
    get durationCSS() {
        return `${this.duration}ms`
    },

    /**
     * Number of beats in the timeline
     */
    beats: 8,
}
