/**
 * @fileoverview D3.js renderer for the interactive family relationship tree.
 * @module ui/family-tree-renderer
 */

import { FAMILY_TREE_LAYOUT, FAMILY_TREE_LINK_STYLES, FAMILY_TREE, FAMILY_TREE_ENABLE_FOCUS_NAVIGATION } from '../constants/family-tree.js';
import { isSingleMemberHousehold } from '../services/family-tree-graph-builder.js';
import { buildFamilyFocusView, resolveFocusRelationshipLabel, resolveNodeVisualRole } from '../services/family-tree-focus.js';
import { layoutFamilyFocusView, buildLinkPath, toCanvasPosition } from './family-tree-layout.js';
import { buildFamilyTreeNodeCardHtml } from './family-tree-card-ui.js';

/**
 * @typedef {import('../services/family-tree-graph-builder.js').FamilyGraph} FamilyGraph
 */

/**
 * @typedef {Object} FamilyTreeRendererOptions
 * @property {HTMLElement} containerEl
 * @property {FamilyGraph} graph
 * @property {string} initialFocusId
 * @property {(nodeId: string, node: import('../services/family-tree-graph-builder.js').FamilyGraphNode) => void} onNodeSelect
 * @property {(nodeId: string) => void} onFocusChange
 */

const { NODE_WIDTH, NODE_HEIGHT, ZOOM_MIN, ZOOM_MAX, TRANSITION_MS } = FAMILY_TREE_LAYOUT;

/**
 * Interactive D3 family tree renderer with zoom, pan, and focus transitions.
 */
export class FamilyTreeRenderer {
  /**
   * @param {FamilyTreeRendererOptions} options
   */
  constructor(options) {
    this.containerEl = options.containerEl;
    this.graph = options.graph;
    this.focusId = options.initialFocusId;
    this.onNodeSelect = options.onNodeSelect;
    this.onFocusChange = options.onFocusChange;

    this.zoomBehavior = null;
    this.svg = null;
    this.rootG = null;
    this.linksG = null;
    this.decorationsG = null;
    this.nodesG = null;
    this.selectedNodeId = null;
    this.isFirstRender = true;

    this._bindResize();
    this.render(this.focusId, false);
  }

  _bindResize() {
    this._resizeHandler = () => {
      if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = requestAnimationFrame(() => this.fitTree());
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
  }

  focusOn(nodeId) {
    if (!this.graph.nodes.has(nodeId)) return;
    this.focusId = nodeId;
    this.render(nodeId, true);
    this.onFocusChange?.(nodeId);
  }

  centerOnOwner() {
    this.focusOn(this.graph.ownerId);
  }

  zoomBy(delta) {
    if (!this.svg || !this.zoomBehavior) return;
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy, delta);
  }

  resetView() {
    if (!this.svg || !this.zoomBehavior) return;
    this.svg.transition().duration(250).call(this.zoomBehavior.transform, d3.zoomIdentity);
    requestAnimationFrame(() => this.fitTree());
  }

  fitTree() {
    if (!this.svg || !this.rootG || !this.containerEl) return;
    const bbox = this.rootG.node()?.getBBox();
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;

    const { width, height } = this.containerEl.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const pad = 48;
    const scale = Math.min(
      (width - pad * 2) / bbox.width,
      (height - pad * 2) / bbox.height,
      ZOOM_MAX,
    );
    const clamped = Math.max(ZOOM_MIN, scale);
    const tx = width / 2 - (bbox.x + bbox.width / 2) * clamped;
    const ty = height / 2 - (bbox.y + bbox.height / 2) * clamped;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(clamped);

    this.svg.transition().duration(TRANSITION_MS).call(this.zoomBehavior.transform, transform);
  }

  setSelectedNode(nodeId) {
    this.selectedNodeId = nodeId;
    if (!this.nodesG) return;
    this.nodesG.selectAll('.family-tree-node')
      .classed('is-selected', (d) => d?.id === nodeId)
      .select('foreignObject')
      .each(function (d) {
        this.querySelector('.family-tree-card')
          ?.classList.toggle('is-selected', d?.id === nodeId);
      });
  }

  render(focusId, animate) {
    this._ensureSvg();

    if (isSingleMemberHousehold(this.graph)) {
      this._clearTree();
      this.isFirstRender = false;
      return;
    }

    const view = buildFamilyFocusView(this.graph, focusId);
    const layout = layoutFamilyFocusView(
      this.graph,
      view.focusId,
      view.nodeIds,
      view.unresolvedIds,
    );
    const duration = animate && !this.isFirstRender ? TRANSITION_MS : 0;

    this._drawLinks(view, layout, duration);
    this._drawUnresolvedSection(layout, duration);
    this._drawNodes(view, layout, duration);

    if (this.isFirstRender) {
      this.isFirstRender = false;
      requestAnimationFrame(() => this.fitTree());
    }

    this.setSelectedNode(this.selectedNodeId);
  }

  _clearTree() {
    this.linksG?.selectAll('*').remove();
    this.decorationsG?.selectAll('*').remove();
    this.nodesG?.selectAll('*').remove();
  }

  _ensureSvg() {
    if (this.svg) return;

    const svg = d3.select(this.containerEl)
      .append('svg')
      .attr('class', 'family-tree-svg')
      .attr('width', '100%')
      .attr('height', '100%');

    const rootG = svg.append('g').attr('class', 'family-tree-root');
    const linksG = rootG.append('g').attr('class', 'family-tree-links');
    const decorationsG = rootG.append('g').attr('class', 'family-tree-decorations');
    const nodesG = rootG.append('g').attr('class', 'family-tree-nodes');

    const zoom = d3.zoom()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .on('zoom', (event) => {
        rootG.attr('transform', event.transform);
      });

    svg.call(zoom);
    svg.on('dblclick.zoom', null);

    this.svg = svg;
    this.rootG = rootG;
    this.linksG = linksG;
    this.decorationsG = decorationsG;
    this.nodesG = nodesG;
    this.zoomBehavior = zoom;
  }

  _canvasPos(pos, layout) {
    return toCanvasPosition(pos, layout);
  }

  _drawLinks(view, layout, duration) {
    const linkData = view.links
      .map((link) => {
        const source = layout.positions.get(link.sourceId);
        const target = layout.positions.get(link.targetId);
        if (!source || !target) return null;
        return {
          ...link,
          source: this._canvasPos(source, layout),
          target: this._canvasPos(target, layout),
        };
      })
      .filter(Boolean);

    const linkSel = this.linksG.selectAll('.family-tree-link')
      .data(linkData, (d) => d.id);

    linkSel.exit()
      .transition().duration(duration)
      .attr('opacity', 0)
      .remove();

    const linkEnter = linkSel.enter()
      .append('path')
      .attr('class', (d) => `family-tree-link family-tree-link--${d.type}`)
      .attr('fill', 'none')
      .attr('opacity', 0);

    linkSel.merge(linkEnter)
      .transition().duration(duration)
      .attr('opacity', 1)
      .attr('d', (d) => this._buildLinkPath(d, layout, view.focusId))
      .attr('stroke', (d) => FAMILY_TREE_LINK_STYLES[d.type]?.stroke || '#c95b14')
      .attr('stroke-width', (d) => FAMILY_TREE_LINK_STYLES[d.type]?.width || 1.5)
      .attr('stroke-dasharray', (d) => FAMILY_TREE_LINK_STYLES[d.type]?.dash || null);
  }

  _buildLinkPath(d, layout, focusId) {
    if (d.type === 'parent-child') {
      const coupleCenter = this._resolveCoupleJunction(d, layout, focusId);
      if (coupleCenter) {
        return buildLinkPath(coupleCenter, d.target, d.type, { sourceAnchor: 'center' });
      }
    }
    return buildLinkPath(d.source, d.target, d.type);
  }

  /**
   * Draws the unresolved relationships section header below the main tree.
   *
   * @param {import('./family-tree-layout.js').FamilyTreeLayoutResult} layout
   * @param {number} duration
   */
  _drawUnresolvedSection(layout, duration) {
    const section = layout.unresolvedSection;
    const headerSel = this.decorationsG.selectAll('.family-tree-unresolved-header')
      .data(section ? [section] : [], () => 'unresolved-header');

    headerSel.exit()
      .transition().duration(duration)
      .attr('opacity', 0)
      .remove();

    const headerEnter = headerSel.enter()
      .append('foreignObject')
      .attr('class', 'family-tree-unresolved-header')
      .attr('opacity', 0);

    const headerWidth = 520;
    const headerHeight = 52;
    const headerHtml = `<div class="family-tree-unresolved-section" role="region" aria-label="${FAMILY_TREE.UNRESOLVED_TITLE}">
        <p class="family-tree-unresolved-section__title">${FAMILY_TREE.UNRESOLVED_TITLE}</p>
        <p class="family-tree-unresolved-section__subtitle">${FAMILY_TREE.UNRESOLVED_SUBTITLE}</p>
      </div>`;

    const merged = headerSel.merge(headerEnter);

    merged.html(headerHtml);

    merged.transition().duration(duration)
      .attr('opacity', 1)
      .attr('x', (d) => {
        const canvas = this._canvasPos({ x: d.centerX, y: d.headerY }, layout);
        return canvas.x - headerWidth / 2;
      })
      .attr('y', (d) => {
        const canvas = this._canvasPos({ x: d.centerX, y: d.headerY }, layout);
        return canvas.y - headerHeight / 2;
      })
      .attr('width', headerWidth)
      .attr('height', headerHeight);
  }

  /**
   * Midpoint on the marriage line when both parents connect to the same child.
   *
   * @param {object} d
   * @param {import('./family-tree-layout.js').FamilyTreeLayoutResult} layout
   * @param {string} focusId
   * @returns {{ x: number, y: number } | null}
   */
  _resolveCoupleJunction(d, layout, focusId) {
    const focus = this.graph.nodes.get(focusId);
    if (!focus?.spouseId || d.sourceId !== focusId) return null;

    const spouseLayout = layout.positions.get(focus.spouseId);
    if (!spouseLayout) return null;

    const spouseCanvas = this._canvasPos(spouseLayout, layout);
    return {
      x: (d.source.x + spouseCanvas.x) / 2,
      y: d.source.y,
    };
  }

  _drawNodes(view, layout, duration) {
    const nodeData = [...view.nodeIds]
      .map((id) => {
        const node = this.graph.nodes.get(id);
        const pos = layout.positions.get(id);
        if (!node || !pos) return null;
        const canvas = this._canvasPos(pos, layout);
        return {
          id,
          node,
          x: canvas.x,
          y: canvas.y,
          relationship: resolveFocusRelationshipLabel(node, view.focusId, this.graph),
          role: resolveNodeVisualRole(node, view.focusId, this.graph),
        };
      })
      .filter(Boolean);

    const nodeSel = this.nodesG.selectAll('.family-tree-node')
      .data(nodeData, (d) => d.id);

    nodeSel.exit()
      .transition().duration(duration)
      .attr('opacity', 0)
      .remove();

    const nodeEnter = nodeSel.enter()
      .append('g')
      .attr('class', 'family-tree-node')
      .attr('opacity', 0)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.onNodeSelect?.(d.id, d.node);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if (FAMILY_TREE_ENABLE_FOCUS_NAVIGATION) {
          this.focusOn(d.id);
        }
      });

    nodeEnter.append('foreignObject')
      .attr('x', -NODE_WIDTH / 2)
      .attr('y', -NODE_HEIGHT / 2)
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .html((d) => this._buildNodeCardHtml(d));

    const merged = nodeSel.merge(nodeEnter);

    merged.select('foreignObject')
      .html((d) => this._buildNodeCardHtml(d));

    merged.transition().duration(duration)
      .attr('opacity', 1)
      .attr('transform', (d) => `translate(${d.x},${d.y})`);
  }

  /**
   * @param {{ id: string, node: object, relationship: string, role: string }} d
   * @returns {string}
   */
  _buildNodeCardHtml(d) {
    return buildFamilyTreeNodeCardHtml({
      node: d.node,
      relationshipLabel: d.relationship,
      role: d.role,
      selected: d.id === this.selectedNodeId,
    });
  }
}
