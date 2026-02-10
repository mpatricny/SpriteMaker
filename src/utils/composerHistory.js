export function createHistory(initialState) {
  return {
    past: [],
    present: initialState,
    future: [],
  }
}

export function pushState(history, newState) {
  return {
    past: [...history.past, history.present],
    present: newState,
    future: [],
  }
}

export function undo(history) {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo(history) {
  if (history.future.length === 0) return history
  const next = history.future[0]
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  }
}

export function canUndo(history) {
  return history.past.length > 0
}

export function canRedo(history) {
  return history.future.length > 0
}
