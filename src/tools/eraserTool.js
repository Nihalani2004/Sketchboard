/**
 * eraserTool.js — Drag across canvas elements to erase them.
 */

import { getStage, getSceneLayer, screenToStage } from '../stage.js';
import { getElements, removeElement, snapshot } from '../scene.js';
import { push as historyPush } from '../history.js';

let isErasing = false;

/** Activate the eraser tool */
export function activateEraserTool(onRenderNeeded) {
  const stage = getStage();
  const sceneLayer = getSceneLayer();

  function eraseAtPointer(clientX, clientY) {
    const pos = screenToStage(clientX, clientY);
    const elements = getElements();
    let erasedAny = false;

    elements.forEach((el) => {
      const node = sceneLayer.findOne(`#${el.id}`);
      if (!node) return;

      const box = node.getClientRect({ relativeTo: sceneLayer });
      // 10px radius hit threshold
      if (
        pos.x >= box.x - 10 &&
        pos.x <= box.x + box.width + 10 &&
        pos.y >= box.y - 10 &&
        pos.y <= box.y + box.height + 10
      ) {
        removeElement(el.id);
        erasedAny = true;
      }
    });

    if (erasedAny && onRenderNeeded) {
      onRenderNeeded();
    }
  }

  function onPointerDown(e) {
    if (e.evt.button !== 0) return;
    isErasing = true;
    historyPush(snapshot());
    eraseAtPointer(e.evt.clientX, e.evt.clientY);
  }

  function onPointerMove(e) {
    if (!isErasing) return;
    eraseAtPointer(e.evt.clientX, e.evt.clientY);
  }

  function onPointerUp() {
    isErasing = false;
  }

  stage.on('pointerdown.eraserTool', onPointerDown);
  stage.on('pointermove.eraserTool', onPointerMove);
  stage.on('pointerup.eraserTool', onPointerUp);

  return () => {
    stage.off('pointerdown.eraserTool');
    stage.off('pointermove.eraserTool');
    stage.off('pointerup.eraserTool');
    isErasing = false;
  };
}
