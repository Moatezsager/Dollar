import React from 'react';
import { AbsoluteFill, Composition, Img, interpolate, registerRoot, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import captures from './captures/manifest.json';

function ConverterLesson({ variant }: { variant: 'mobile' | 'desktop' }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const step = Math.min(3, Math.floor(frame / 150));
  const capture = captures[variant][step];
  const strength = interpolate(frame % 150, [0, 15, 120, 149], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const highlight = { position: 'absolute' as const, left: capture.x, top: capture.y, width: capture.width, height: capture.height, border: '4px solid #6ee7b7', borderRadius: 12, boxShadow: '0 0 0 6px #6ee7b722', opacity: strength, pointerEvents: 'none' as const };
  // Keep the crop inside the tool so its original footer does not duplicate captions.
  const maxPan = captures.mobile[2].y + captures.mobile[2].height + 42 - 800;
  const focusOffset = (index: number) => Math.max(0, Math.min(maxPan, index === 3
    ? captures.mobile[1].y - 192
    : captures.mobile[index].y + captures.mobile[index].height / 2 - 478));
  const pan = interpolate(frame % 150, [0, 25], [focusOffset(Math.max(0, step - 1)), focusOffset(step)], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: '#101315' }}>
    {variant === 'mobile' ? <>
      <div style={{ position: 'absolute', top: 0, width: 720, height: 156, overflow: 'hidden' }}>
        <Img src={staticFile(`mobile-${step}.png`)} style={{ width: 720, height: 1472 }} />
      </div>
      <div style={{ position: 'absolute', top: 156, width: 720, height: 644, overflow: 'hidden' }}>
        <Img src={staticFile(`mobile-${step}.png`)} style={{ position: 'absolute', top: -156 - pan, width: 720, height: 1472 }} />
        <div style={{ ...highlight, top: capture.y - 156 - pan }} />
      </div>
      <Img src={staticFile(`mobile-caption-${step}.png`)} style={{ position: 'absolute', left: 40, bottom: 88, width: 640, height: 152, objectFit: 'contain' }} />
    </> : <>
      <Img src={staticFile(`${variant}-${step}.png`)} style={{ width: '100%', height: '100%' }} />
      <div style={highlight} />
    </>}
    <div style={{ position: 'absolute', bottom: 0, left: 0, height: 5, width: `${frame / (durationInFrames - 1) * 100}%`, backgroundColor: '#6ee7b7' }} />
  </AbsoluteFill>;
}

function Root() {
  return <>
    <Composition id="ConverterMobile" component={ConverterLesson} width={720} height={1040} fps={30} durationInFrames={600} defaultProps={{ variant: 'mobile' as const }} />
    <Composition id="ConverterDesktop" component={ConverterLesson} width={1280} height={1120} fps={30} durationInFrames={600} defaultProps={{ variant: 'desktop' as const }} />
  </>;
}
registerRoot(Root);
