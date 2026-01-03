import { css } from '@linaria/core'
import { colorTheme, colors } from './colors'
import { fragments } from './fragments'
import { notCss } from './util'
import './font.css'
import { fontName } from './fonts'
import { themeColors } from './themeColors'

export const style = notCss({
  colors,
  themeColors,
})

export const globalStyle = css`
  :global(:root) {
    ${colorTheme}

    font-family: "${fontName}";

    ${fragments.textStyle.body.m.regular};
    line-height: normal;

    color-scheme: light dark;
    color: ${style.themeColors.text.default};
    background-color: ${style.themeColors.background.default};

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    interpolate-size: allow-keywords;
    cursor: default;
    user-select: none;
  }

  :global(:root:focus) {
    outline: none;
  }

  :global(*) {
    font-synthesis: style small-caps weight;
    font-family: "${fontName}";
    ${fragments.textStyle.body.m.regular};
    line-height: normal;
  }

  :global(*:focus) {
    outline: none;
  }

  :global(body) {
    margin: 0;
    display: flex;
    place-items: center;
    min-width: 320px;
    min-height: 100vh;
  }

  :global(a) {
    color: ${style.themeColors.text.link};
    transition: ${fragments.transition.fast('color')};
  }

  :global(a:hover) {
    color: ${style.colors.aqua[500]};
  }

  :global(a:visited) {
    color: ${style.colors.aqua[600]};
  }

  :global(a:visited:hover) {
    color: ${style.colors.aqua[700]};
  }

  :global(h1) {
    ${fragments.textStyle.heading.xxl}
  }

  :global(h2) {
    ${fragments.textStyle.heading.xl};
  }

  :global(h3) {
    ${fragments.textStyle.heading.l};
  }

  :global(h4) {
    ${fragments.textStyle.heading.m};
  }

  :global(code) {
    white-space: nowrap;
    border: 1px solid ${style.themeColors.line.default};
    padding: 0 4px;
    color: ${style.themeColors.text.important};
    background-color: ${style.themeColors.background.default};
  }

  :global(#root) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
`
