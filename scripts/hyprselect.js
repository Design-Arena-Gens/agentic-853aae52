#!/usr/bin/env gjs
'use strict';

// GTK3-based overlay selector for Hyprland
// - Dims the screen
// - Click-drag to draw a selection
// - On release, snaps to nearest 1 of 9 grid cells (3x3)
// - Moves/resizes the active window to that cell via hyprctl

imports.gi.versions.Gtk = '3.0';
imports.gi.versions.Gdk = '3.0';
const { Gtk, Gdk, GLib, Gio, Cairo } = imports.gi;

let startX = 0;
let startY = 0;
let curX = 0;
let curY = 0;
let selecting = false;

function clamp(min, v, max) { return Math.max(min, Math.min(v, max)); }

function getMonitorRect(window) {
  // Use window allocation as fullscreen overlay geometry
  const alloc = window.get_allocation();
  return { x: 0, y: 0, width: alloc.width, height: alloc.height };
}

function computeSelectionRect() {
  const x1 = Math.min(startX, curX);
  const y1 = Math.min(startY, curY);
  const x2 = Math.max(startX, curX);
  const y2 = Math.max(startY, curY);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function snapToGrid(window, rect) {
  const mon = getMonitorRect(window);
  const cellW = mon.width / 3.0;
  const cellH = mon.height / 3.0;
  const cx = rect.x + rect.w / 2.0;
  const cy = rect.y + rect.h / 2.0;
  const col = clamp(0, Math.floor(cx / cellW), 2);
  const row = clamp(0, Math.floor(cy / cellH), 2);
  return {
    x: Math.round(col * cellW),
    y: Math.round(row * cellH),
    w: Math.round(cellW),
    h: Math.round(cellH),
  };
}

function hyprMoveResize(x, y, w, h) {
  // Best-effort commands; ignore failures
  try { GLib.spawn_command_line_async(`hyprctl dispatch moveactive exact ${x} ${y}`); } catch (e) {}
  try { GLib.spawn_command_line_async(`hyprctl dispatch resizeactive exact ${w} ${h}`); } catch (e) {}
}

function main() {
  Gtk.init(null);

  const win = new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL });
  win.set_title('HyprSelect');
  win.set_decorated(false);
  win.set_app_paintable(true);
  win.set_keep_above(true);
  win.set_accept_focus(true);
  win.fullscreen();

  // Container to receive events and paint translucent background
  const area = new Gtk.DrawingArea();
  area.set_hexpand(true);
  area.set_vexpand(true);
  area.add_events(
    Gdk.EventMask.BUTTON_PRESS_MASK |
    Gdk.EventMask.BUTTON_RELEASE_MASK |
    Gdk.EventMask.POINTER_MOTION_MASK |
    Gdk.EventMask.KEY_PRESS_MASK
  );

  area.connect('draw', (widget, cr) => {
    const alloc = widget.get_allocation();
    const w = alloc.width;
    const h = alloc.height;

    // Dim background
    cr.setSourceRGBA(0.02, 0.06, 0.14, 0.55);
    cr.setOperator(Cairo.Operator.SOURCE);
    cr.rectangle(0, 0, w, h);
    cr.fill();

    // Draw 3x3 grid lines
    cr.setSourceRGBA(1, 1, 1, 0.25);
    cr.setLineWidth(1);
    cr.moveTo(w / 3, 0); cr.lineTo(w / 3, h);
    cr.moveTo((2 * w) / 3, 0); cr.lineTo((2 * w) / 3, h);
    cr.moveTo(0, h / 3); cr.lineTo(w, h / 3);
    cr.moveTo(0, (2 * h) / 3); cr.lineTo(w, (2 * h) / 3);
    cr.stroke();

    // Selection rectangle while dragging
    if (selecting) {
      const r = computeSelectionRect();
      cr.setSourceRGBA(0.22, 0.74, 0.97, 0.25);
      cr.rectangle(r.x, r.y, Math.max(1, r.w), Math.max(1, r.h));
      cr.fill();

      cr.setSourceRGBA(0.22, 0.74, 0.97, 0.9);
      cr.setLineWidth(2);
      cr.rectangle(r.x + 1, r.y + 1, Math.max(1, r.w) - 2, Math.max(1, r.h) - 2);
      cr.stroke();
    }

    // Hint text
    cr.setSourceRGBA(1, 1, 1, 0.8);
    // Skip text rendering complexity; dim overlay is sufficient.

    return false;
  });

  area.connect('button-press-event', (widget, event) => {
    selecting = true;
    startX = event.x;
    startY = event.y;
    curX = startX;
    curY = startY;
    widget.queue_draw();
    return true;
  });

  area.connect('motion-notify-event', (widget, event) => {
    if (!selecting) return false;
    curX = event.x;
    curY = event.y;
    widget.queue_draw();
    return true;
  });

  function finishSelection(widget) {
    if (!selecting) return;
    selecting = false;
    const rect = computeSelectionRect();
    const snapped = snapToGrid(win, rect);
    hyprMoveResize(snapped.x, snapped.y, snapped.w, snapped.h);
    Gtk.main_quit();
  }

  area.connect('button-release-event', (widget, event) => {
    finishSelection(widget);
    return true;
  });

  win.add_events(Gdk.EventMask.KEY_PRESS_MASK);
  win.connect('key-press-event', (_w, event) => {
    const keyval = event.get_keyval()[1];
    // Esc to cancel
    if (keyval === Gdk.KEY_Escape) {
      Gtk.main_quit();
      return true;
    }
    return false;
  });

  win.add(area);
  win.connect('destroy', () => Gtk.main_quit());
  win.show_all();

  Gtk.main();
}

main();
