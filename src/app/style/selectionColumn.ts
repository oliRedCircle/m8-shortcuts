import { css } from '@linaria/core'
import { style } from './style'

/**
 * Shared column class for ScreenSelection and ActivitySelection.
 * Handles: scrollable content, min-width 350px, responsive fold at <900px,
 * hover-to-expand on the collapsed 30px strip.
 */
export const columnClass = css`
  position: relative;
  background: ${style.themeColors.background.default};

  > .content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 100%;
    width: fit-content;
    min-width: 350px;
    max-width: 550px;
    max-height: 100%;
    overflow-y: scroll;
    padding-right: 8px;

    > h3 {
      margin: 0 0 15px 0;
    }
  }

  > .sidebar-title {
    display: none;
  }

  @media (max-width: 900px) {
    & {
      width: 30px;
      max-width: 30px;
      flex: 0 0 30px;
      border-left: 1px solid ${style.themeColors.line.default};

      > .sidebar-title {
        display: block;
        transform: translateX(5px) rotate(90deg);
        padding-left: 30px;
        z-index: 2;
      }

      > .content {
        z-index: 1;
        position: absolute;
        background: ${style.themeColors.background.default};
        left: 10px;
        opacity: 0;
        transform: translateX(-100%);
        transition: 0.25s ease transform, 0.25s 0.1s ease opacity;
        pointer-events: none;
        padding-left: 10px;
        padding-right: 30px;
        border-right: 1px solid ${style.themeColors.line.default};
        min-height: 100vh;
        max-width: calc(90vw - 125px);

        > .sticky-fill {
          z-index: 2;
          min-height: 25px;
          width: 100%;
          position: sticky;
          top: 0;
          background-color: ${style.themeColors.background.default};
        }
      }

      &:hover,
      & > .content:hover {
        overflow-x: visible;
        > .content {
          opacity: 1;
          transform: translateX(0);
          pointer-events: all;
        }
      }
    }
  }
`

/**
 * Shared category class for grouped lists inside ScreenSelection and ActivitySelection.
 */
export const columnCategoryClass = css`
  scrollbar-gutter: stable;
  isolation: isolate;

  > h2 {
    cursor: pointer;
    background-color: ${style.themeColors.background.default};
    position: sticky;
    z-index: 2;
    display: flex;
    align-items: center;
    top: 0px;
    padding: 24px 4px 4px 4px;
    margin: 0;
    border-bottom: 2px solid ${style.themeColors.line.default};
  }
`
