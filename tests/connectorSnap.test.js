import { describe, expect, it } from 'vitest';
import { snapConnectorEndpoint } from '../src/shapes/connectorSnap.js';

describe('connector endpoint snapping', () => {
  it('attaches an endpoint to a nearby ellipse outline', () => {
    const endpoint = snapConnectorEndpoint(
      { x: 206, y: 80 },
      [{ id: 'ellipse_1', type: 'ellipse', x: 20, y: 30, width: 180, height: 100 }],
      12,
    );

    expect(endpoint.x).toBeCloseTo(200);
    expect(endpoint.y).toBeCloseTo(80);
  });

  it('attaches to the actual edge of a diamond rather than its bounding box', () => {
    const endpoint = snapConnectorEndpoint(
      { x: 156, y: 50 },
      [{ id: 'diamond_1', type: 'diamond', x: 20, y: 20, width: 120, height: 80 }],
      20,
    );

    expect(endpoint.x).toBeCloseTo(140);
    expect(endpoint.y).toBeCloseTo(60);
  });

  it('does not move endpoints that are not near a shape', () => {
    const point = { x: 240, y: 240 };
    expect(snapConnectorEndpoint(point, [{ id: 'rect_1', type: 'rectangle', x: 20, y: 20, width: 100, height: 80 }], 12)).toEqual(point);
  });

  it('uses the rotated outline for transformed shapes', () => {
    const endpoint = snapConnectorEndpoint(
      { x: 106, y: 50 },
      [{ id: 'rect_1', type: 'rectangle', x: 100, y: 50, width: 60, height: 40, angle: 90 }],
      12,
    );

    expect(endpoint).toEqual({ x: 100, y: 50 });
  });
});
