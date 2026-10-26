import React, { useRef, useEffect, useState } from "react";

// A draggable, focusable window with classic Win95 chrome.
export default function Window({ win, focused, onFocus, onClose, onMin, onMax, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: win.x, y: win.y });
  const [size, setSize] = useState({ w: win.w, h: win.h });
  const drag = useRef(null);

  useEffect(() => {
    const move = (e) => {
      if (!drag.current) return;
      const d = drag.current;
      const nx = Math.max(0, Math.min(window.innerWidth - 80, d.sx + (e.clientX - d.cx)));
      const ny = Math.max(0, Math.min(window.innerHeight - 60, d.sy + (e.clientY - d.cy)));
      setPos({ x: nx, y: ny });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const startDrag = (e) => {
    onFocus(win.id);
    if (win.max) return;
    drag.current = { cx: e.clientX, cy: e.clientY, sx: pos.x, sy: pos.y };
  };

  // right-bottom resize grip
  const startResize = (e) => {
    e.stopPropagation();
    onFocus(win.id);
    const sx = size.w, sy = size.h, cx = e.clientX, cy = e.clientY;
    const move = (ev) => {
      setSize({
        w: Math.max(300, sx + (ev.clientX - cx)),
        h: Math.max(180, sy + (ev.clientY - cy)),
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const style = {
    left: pos.x, top: pos.y, width: size.w, height: size.h,
    zIndex: win.z,
  };

  return (
    <div ref={ref} className={"win bevel-window" + (focused ? " focused" : "") + (win.min ? " is-min" : "") + (win.max ? " is-max" : "")}
      style={style} onMouseDown={() => onFocus(win.id)}>
      <div className="win-title" onMouseDown={startDrag}>
        <span style={{ fontSize: 10, fontWeight: 700 }}>▪</span>
        <span className="win-title-text">{win.title}</span>
        <span className="win-title-btns">
          <button className="tbb" title="Minimize" onClick={(e) => { e.stopPropagation(); onMin(win.id); }}>_</button>
          <button className="tbb" title="Maximize" onClick={(e) => { e.stopPropagation(); onMax(win.id); }}>□</button>
          <button className="tbb" title="Close" onClick={(e) => { e.stopPropagation(); onClose(win.id); }}>✕</button>
        </span>
      </div>
      <div className="win-body" style={win.whiteBody ? { background: "#fff", margin: "0 2px", boxShadow: "inset 1px 1px 0 #808080, inset -1px -1px 0 #fff" } : null}>
        {children}
      </div>
      <div className="win-status">
        <span className="slot bevel-in">{win.status || "Ready"}</span>
        <span className="slot fix bevel-in" style={{ minWidth: 60 }}>{win.tag || "RIGOR"}</span>
      </div>
      {!win.max && (
        <div onMouseDown={startResize}
          style={{ position: "absolute", right: 2, bottom: 2, width: 12, height: 12, cursor: "nwse-resize",
            background: "linear-gradient(135deg, transparent 40%, #808080 41%, #808080 55%, transparent 56%, transparent 70%, #808080 71%, #808080 85%, transparent 86%)" }} />
      )}
    </div>
  );
}
