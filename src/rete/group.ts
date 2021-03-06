import { Drag } from './view/drag';
import { Node } from './node';
import { NodeEditor } from './editor'
import { Connection } from './connection';

const min = (arr: number[]) => arr.length === 0 ? 0 : Math.min(...arr);
const max = (arr: number[]) => arr.length === 0 ? 0 : Math.max(...arr);

const MINIMIZED_GROUP_WIDTH = 160;
const MINIMIZED_GROUP_HEIGHT = 160;


type Rect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width?: number;
    height?: number;
    getCenter?: () => number[];
}

export function nodesBBox(editor: NodeEditor, nodes: Node[], margin: number): Rect {
    const left = min(nodes.map(node => node.position[0])) - margin;
    const top = min(nodes.map(node => node.position[1])) - margin;
    const right = max(nodes.map(node => node.position[0] + editor.view.nodes.get(node)!.el.clientWidth)) + 2 * margin;
    const bottom = max(nodes.map(node => node.position[1] + editor.view.nodes.get(node)!.el.clientHeight)) + 2 * margin;

    return {
        left,
        right,
        top,
        bottom,
        width: Math.abs(left - right),
        height: Math.abs(top - bottom),
        getCenter: () => {
            return [
                (left + right) / 2,
                (top + bottom) / 2
            ];
        }
    };
}

export function containsRect(r1: Rect, r2: Rect) {
    return (
        r2.left > r1.left &&
        r2.right < r1.right &&
        r2.top > r1.top &&
        r2.bottom < r1.bottom
    );
}

export class NodeGroup {
    private _dragStart = [0, 0];
    private groupElement: HTMLElement;
    private x = 0;
    private y = 0;
    private _dragging = false;
    private _layouting = false;
    dragHandler: Drag;
    sockets = new Map<HTMLElement, Node>();
    connections = new Map<Connection, HTMLElement>();
    groupTitleElement: HTMLSpanElement;
    title = "Group";

    constructor(private editor: NodeEditor, public name: string, public nodes: Node[] = [], public minimized = false) {
        this.groupElement = document.createElement('div');
        this.groupElement.id = `group-${name}`;
        this.groupElement.classList.add("groupElement", "groupMaximized");
        this.editor.view.container.children[0].appendChild(this.groupElement)
        this.dragHandler = new Drag(this.groupElement, this.onTranslate, this.onStart, this.onDrag);

        const groupMinimizeElement = document.createElement('div');
        groupMinimizeElement.id = `group-${name}-min`;
        groupMinimizeElement.classList.add("groupMinimizeElement")
        groupMinimizeElement.addEventListener('pointerdown', this.toggleMinimize);

        const groupRenameElement = document.createElement('div');
        groupRenameElement.id = `group-${name}-ren`;
        groupRenameElement.classList.add("groupRenameElement")
        groupRenameElement.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            editor.trigger("group_title_edit", this);
        });

        const groupDeleteElement = document.createElement('div');
        groupDeleteElement.id = `group-${name}-del`;
        groupDeleteElement.classList.add("groupDeleteElement")
        groupDeleteElement.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            editor.trigger("group_delete", this.name);
        });
        this.groupTitleElement = document.createElement('span');
        this.groupTitleElement.id = `group-${name}-title`;
        this.groupTitleElement.classList.add("groupTitleElement");
        this.groupTitleElement.textContent = this.title;

        this.groupElement.appendChild(groupRenameElement)
        this.groupElement.appendChild(groupDeleteElement)
        this.groupElement.appendChild(groupMinimizeElement)
        this.groupElement.appendChild(this.groupTitleElement)
    }

    setTitle = (t: string) => {
        this.groupTitleElement.textContent = t;
        this.title = t;
    }

    toggleMinimize = (e: PointerEvent) => {
        e.stopPropagation(); this.minimized = !this.minimized;
        this.groupElement.classList.remove("groupMaximized");
        if (!this.minimized) {
            this.groupElement.classList.add("groupMaximized");
            this._layouting = true;
            //TODO: replace this with auto arrange. Right now - just stupid horizontal layout
            for (let index = 0; index < this.nodes.length; index++) {
                const n = this.nodes[index];
                const nodeView = (this.editor.view.nodes.get(n)!);

                nodeView.translate(this.nodes[0].position[0] + 130 * index, this.nodes[0].position[1])
            }
            for (let con of this.connections.keys()) {
                const conView = this.editor.view.connections.get(con)!;
                conView.pointOverride = undefined;
                conView.update();
            }
            this._layouting = false;
        }
        this.updateNodesVisibility();
        this.editor.trigger('process');
    }

    bbox() {
        return nodesBBox(this.editor, this.nodes, 30)
    }

    removeNode(n: Node) {
        this.nodes.splice(this.nodes.indexOf(n), 1);
        delete n.data.group;
        this.update();
    }

    destroySockets() {
        for (let ve of this.sockets.keys()) {
            ve.parentElement?.remove();
        }
        this.sockets.clear();
        this.connections.clear();
    }

    rebuildSockets() {
        this.destroySockets();
        let inputCount = 0;
        let outputCount = 0;
        this.nodes.forEach(node => {
            node.getConnections().forEach(nc => {
                if (nc.output && nc.output.node && this.nodes.indexOf(nc.output.node!) === -1) {
                    // input of this node comes from outside of the group. add input socket
                    inputCount++;
                    const socketWrapper = document.createElement('div');
                    this.groupElement.appendChild(socketWrapper)
                    const socket = document.createElement('div');
                    socketWrapper.appendChild(socket)
                    const socketTitle = document.createElement('span');
                    socketTitle.textContent = nc.output.node.name;
                    socketTitle.classList.add("socketTitleIn")
                    socketWrapper.classList.add("socketWrapper")
                    socketWrapper.appendChild(socketTitle);
                    this.sockets.set(socket, node);
                    socket.id = `group-${this.name}-socket-inp-${node.id}-${inputCount}`;
                    socket.classList.add("groupMinimizedSocket")
                    socketWrapper.style.transform = `translate(-15px, ${30 + inputCount * 40}px)`;
                    this.connections.set(nc, socket);
                }
                if (nc.input && nc.input.node && this.nodes.indexOf(nc.input.node!) === -1) {
                    // output of this node goes outside of the group. add output socket
                    outputCount++;
                    const socketWrapper = document.createElement('div');
                    this.groupElement.appendChild(socketWrapper)
                    const socket = document.createElement('div');
                    socketWrapper.appendChild(socket);
                    socketWrapper.classList.add("socketWrapper", "socketWrapperOut")
                    const socketTitle = document.createElement('span');
                    socketTitle.textContent = nc.input.node.name;
                    socketTitle.classList.add("socketTitleOut")
                    // socketTitle.style.transform = `translate(130px, ${36 + outputCount * 40}px)`;

                    socketWrapper.appendChild(socketTitle);
                    this.sockets.set(socket, node);
                    socket.id = `group-${this.name}-socket-out-${node.id}-${outputCount}`;
                    socket.classList.add("groupMinimizedSocket", "groupMinimizedSocketOutput")
                    socketWrapper.style.transform = `translate(125px, ${30 + outputCount * 40}px)`;
                    this.connections.set(nc, socket);
                }
            })
        });
    }

    canTranslateNode(node: Node, x: number, y: number): boolean {
        if (this._dragging || this._layouting) return true;
        const el = (this.editor.view.nodes.get(node)!).el;
        const { width, height } = el.getBoundingClientRect();
        const t1 = y < this.y;
        const t2 = y + height * this.editor.view.area.transform.k > this.y + this.groupElement.clientHeight;
        const t3 = x < this.x;
        const t4 = x + width * this.editor.view.area.transform.k > this.x + this.groupElement.clientWidth;
        const outside = (t1 || t2 || t3 || t4)
        return !outside;
    }

    updateConnectionViews() {
        if (!this.minimized) return;
        let bb = this.bbox();

        this.connections.forEach((socketElement, connection) => {

            const conView = (this.editor.view.connections.get(connection)!);
            const isInput = connection.input.node ? this.nodes.includes(connection.input.node) : false;
            const points = conView.getPoints();
            let idx = isInput ? 2 : 0;
            const matrix = new WebKitCSSMatrix(socketElement.parentElement!.style.webkitTransform);
            points[idx] = bb.left + matrix.m41 + socketElement.clientWidth / 2;
            points[idx + 1] = bb.top + matrix.m42 + socketElement.clientWidth / 2;
            conView.pointOverride = points

            conView.update();
        });
    }

    updateNodesVisibility() {
        for (let index = 0; index < this.nodes.length; index++) {
            const element = this.nodes[index];
            const nodeView = (this.editor.view.nodes.get(element)!);
            nodeView.el.style.display = this.minimized ? 'none' : 'block';
            element.getConnections().forEach(con => {
                const conView = (this.editor.view.connections.get(con)!);
                // if this is an 'inter-group' connection - hide it
                if (!this.connections.has(con)) {
                    conView.el.style.display = this.minimized ? "none" : "block";
                }
            })
        }
        this.update()
    }

    update() {
        const bbox = this.bbox();
        this.x = bbox.left;
        this.y = bbox.top;
        const scale = 1.0;
        this.groupElement.style.transform = `translate(${this.x}px, ${this.y}px) scale(${scale})`;
        this.groupElement.style.width = (this.minimized ? MINIMIZED_GROUP_WIDTH : bbox.width) + 'px';
        this.groupElement.style.height = (this.minimized ? MINIMIZED_GROUP_HEIGHT : bbox.height) + 'px';
        this.updateConnectionViews();
    }

    destroy() {
        this.nodes.forEach(n => n.data.group = undefined);
        this.nodes = [];
        this.update();
        this.dragHandler.destroy();
        this.groupElement.remove();
        this.destroySockets();
    }

    onStart = () => {
        this._dragStart = [0, 0];
        this._dragging = true;
    }

    onDrag = () => {
        this._dragging = false;
    }

    onTranslate = (x: number, y: number) => {
        const dx = x - this._dragStart[0];
        const dy = y - this._dragStart[1];
        this._dragStart = [x, y];
        this.nodes.map(n => this.editor.view.nodes.get(n)!).forEach(v => {
            v.translate(v.node.position[0] + dx * this.editor.view.area.transform.k, v.node.position[1] + dy * this.editor.view.area.transform.k)
        });
        this.update();
    }

    addNode(node: Node) {
        this.nodes.push(node);
        this.update()
    }

}