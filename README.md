# 3D Frame Viewer

A standalone demonstration of a 3D picture frame component rendered using Three.js and React Three Fiber. This project showcases advanced profile-based geometry generation with Bezier curves for realistic frame rendering.

## Features

- **Profile-based 3D Geometry**: Uses CAD-style profile points with Bezier curve support
- **PBR Texturing**: Physically-based rendering with normal, albedo, roughness, and AO maps
- **Realistic Materials**: Frame with glass, backing, and hanging wire system
- **Interactive**: Rotate, zoom, and pan with mouse controls
- **Standalone**: No external dependencies on server state or Redux

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the 3D frame in your browser.

## Frame Profile Points

The frame uses a custom profile defined by 15 vertices with the following characteristics:

- **Linear segments**: Straight edges for clean lines
- **Bezier curves**: Smooth transitions and ornate details
- **Total width**: 3 inches
- **Total depth**: 2 inches

The profile points are hardcoded in `app/page.tsx` and can be modified to create different frame styles.

## Static Assets

Textures are loaded from `public/textures/`:

- `edge.png` - Frame edge texture
- `side.png` - Frame side texture
- `backing.png` - Frame backing texture
- `logo.png` - Sample artwork (can be replaced)

## Component Structure

```
components/
└── 3d/
    └── RealFrame.tsx  - Main 3D frame component

app/
└── page.tsx           - Viewer page with controls
```

## Customization

### Frame Dimensions

Edit the props in `app/page.tsx`:

```typescript
<RealFrame
  width={16}          // Outer width in inches
  height={20}         // Outer height in inches
  frameWidth={3}      // Frame material width
  frameDepth={2}      // Frame thickness
  // ...other props
/>
```

### Profile Points

Modify the `PROFILE_POINTS` array in `app/page.tsx` to create custom frame shapes. Each point supports:

- `x`, `y`: 2D coordinates
- `segment_type`: "linear" or "bezier"
- `control_points`: Optional Bezier control points

### Textures

Replace images in `public/textures/` or update the URLs in `app/page.tsx`.

## Technologies

- **Next.js 15** - React framework
- **Three.js** - 3D graphics library
- **React Three Fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

## Build

```bash
npm run build
npm start
```

## Notes

- This is a demonstration/testing project extracted from a larger framing application
- The RealFrame component has been simplified to work standalone without Redux state
- Mouse controls: Left-click drag to rotate, scroll to zoom, right-click drag to pan

## License

MIT
