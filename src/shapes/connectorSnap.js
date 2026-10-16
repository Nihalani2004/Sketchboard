/**
 * Connector endpoint geometry.
 *
 * Arrows are intentionally independent drawable elements, but their endpoints
 * should still meet a nearby shape's visible outline.  This module keeps that
 * interaction as pure geometry so it can be shared and unit tested without
 * depending on Konva.
 */

import { isDrawShape } from './catalog.js';

const CONNECTOR_TYPES = new Set(['line', 'arrow']);

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rotate(point, angle) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function toLocal(point, element) {
  const translated = { x: point.x - element.x, y: point.y - element.y };
  return rotate(translated, -(element.angle || 0));
}

function toStage(point, element) {
  const rotated = rotate(point, element.angle || 0);
  return { x: rotated.x + element.x, y: rotated.y + element.y };
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return { ...start };
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return { x: start.x + dx * ratio, y: start.y + dy * ratio };
}

function closestPointOnPolygon(point, vertices) {
  let closest = null;
  vertices.forEach((start, index) => {
    const candidate = closestPointOnSegment(point, start, vertices[(index + 1) % vertices.length]);
    if (!closest || distance(point, candidate) < distance(point, closest)) closest = candidate;
  });
  return closest;
}

function closestPointOnRectangle(point, width, height) {
  const inside = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
  if (inside) {
    const distances = [
      { value: point.x, point: { x: 0, y: point.y } },
      { value: width - point.x, point: { x: width, y: point.y } },
      { value: point.y, point: { x: point.x, y: 0 } },
      { value: height - point.y, point: { x: point.x, y: height } },
    ];
    return distances.reduce((closest, candidate) => candidate.value < closest.value ? candidate : closest).point;
  }
  return {
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y)),
  };
}

function closestPointOnEllipse(point, width, height) {
  const radiusX = width / 2;
  const radiusY = height / 2;
  const center = { x: radiusX, y: radiusY };
  if (radiusX === 0 || radiusY === 0) return center;

  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;
  const ratio = Math.hypot(offsetX / radiusX, offsetY / radiusY);
  if (ratio === 0) return { x: width, y: radiusY };
  return {
    x: center.x + offsetX / ratio,
    y: center.y + offsetY / ratio,
  };
}

function closestPointOnShape(point, element) {
  const { type, width, height } = element;
  if (type === 'ellipse' || type === 'cloud') return closestPointOnEllipse(point, width, height);
  if (type === 'diamond' || type === 'flowchart-decision') {
    return closestPointOnPolygon(point, [
      { x: width / 2, y: 0 }, { x: width, y: height / 2 },
      { x: width / 2, y: height }, { x: 0, y: height / 2 },
    ]);
  }
  if (type === 'triangle') {
    return closestPointOnPolygon(point, [{ x: width / 2, y: 0 }, { x: width, y: height }, { x: 0, y: height }]);
  }
  if (type === 'flowchart-input-output') {
    const inset = Math.min(width * 0.2, height * 0.45);
    return closestPointOnPolygon(point, [
      { x: inset, y: 0 }, { x: width, y: 0 }, { x: width - inset, y: height }, { x: 0, y: height },
    ]);
  }
  if (type === 'callout') {
    const tip = Math.min(width, height) * 0.22;
    return closestPointOnPolygon(point, [
      { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height - tip },
      { x: width * 0.42, y: height - tip }, { x: width * 0.25, y: height },
      { x: width * 0.3, y: height - tip }, { x: 0, y: height - tip },
    ]);
  }
  if (type === 'sticky-note') {
    const fold = Math.min(width, height) * 0.23;
    return closestPointOnPolygon(point, [
      { x: 0, y: 0 }, { x: width - fold, y: 0 }, { x: width, y: fold }, { x: width, y: height }, { x: 0, y: height },
    ]);
  }
  return closestPointOnRectangle(point, width, height);
}

/**
 * Return a point snapped to the closest nearby closed-shape outline.
 * The supplied distance is in scene units so callers can keep the tolerance
 * visually consistent at every zoom level.
 */
export function snapConnectorEndpoint(point, elements, maxDistance) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !Number.isFinite(maxDistance)) return point;

  let closest = null;
  (elements || []).forEach((element) => {
    if (!isDrawShape(element.type) || CONNECTOR_TYPES.has(element.type)) return;
    if (!Number.isFinite(element.width) || !Number.isFinite(element.height) || element.width <= 0 || element.height <= 0) return;

    const localPoint = toLocal(point, element);
    const localCandidate = closestPointOnShape(localPoint, element);
    const candidate = toStage(localCandidate, element);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance <= maxDistance && (!closest || candidateDistance < closest.distance)) {
      closest = { point: candidate, distance: candidateDistance };
    }
  });

  return closest ? closest.point : point;
}
