import { Drag } from './view/drag';
import { Node } from './node';
import { NodeEditor } from './editor'

const min = (arr: number[]) => arr.length === 0 ? 0 : Math.min(...arr);
const max = (arr: number[]) => arr.length === 0 ? 0 : Math.max(...arr);

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
    private el: HTMLElement;
    private x = 0;
    private y = 0;
    private _dragging = false;
    private _layouting = false;

    constructor(private editor: NodeEditor, public name: string, public nodes: Node[] = [], public minimized = false) {
        const groupElement = document.createElement('div');
        groupElement.id = `group-${name}`;
        groupElement.style.position = 'absolute';
        groupElement.style.zIndex = '-1';
        (groupElement as any).dragHandler = new Drag(groupElement, this.onTranslate, this.onStart, this.onDrag);
        const groupMinimizeElement = document.createElement('div');
        groupMinimizeElement.id = `group-${name}-min`;
        groupMinimizeElement.style.position = 'absolute';
        groupMinimizeElement.style.zIndex = '-1';
        groupMinimizeElement.style.backgroundColor = 'red';
        groupMinimizeElement.style.width = "30px";
        groupMinimizeElement.style.height = "30px";
        groupMinimizeElement.addEventListener('pointerdown', this.toggleMinimize);
        this.editor.view.container.children[0].appendChild(groupElement)
        groupElement.appendChild(groupMinimizeElement)
        this.el = groupElement;
    }

    toggleMinimize = () => {
        this.minimized = !this.minimized;
        if (!this.minimized) {
            this._layouting = true;
            //TODO: replace this with auto arrange. Right now - just stupid horizontal layout
            for (let index = 0; index < this.nodes.length; index++) {
                const n = this.nodes[index];
                const nodeView = (this.editor.view.nodes.get(n)!);

                nodeView.translate(this.nodes[0].position[0] + 130 * index, this.nodes[0].position[1])
            }
            this._layouting = false;
        }
        this.updateNodesVisibility();
        this.editor.trigger('process');
    }

    removeNode(n: Node) {
        this.nodes.splice(this.nodes.indexOf(n), 1);
        delete n.data.group;
        this.update();
    }

    canTranslateNode(node: Node, x: number, y: number): boolean {
        if (this._dragging || this._layouting) return true;
        const el = (this.editor.view.nodes.get(node)!).el;
        const { width, height } = el.getBoundingClientRect();
        const t1 = y < this.y;
        const t2 = y + height * this.editor.view.area.transform.k > this.y + this.el.clientHeight;
        const t3 = x < this.x;
        const t4 = x + width * this.editor.view.area.transform.k > this.x + this.el.clientWidth;
        const outside = (t1 || t2 || t3 || t4)
        return !outside;
    }

    updateNodesVisibility() {
        this._layouting = true;
        if (this.nodes.length > 0) {

            for (let index = 0; index < this.nodes.length; index++) {
                const element = this.nodes[index];
                const nodeView = (this.editor.view.nodes.get(element)!);
                nodeView.el.style.display = this.minimized ? 'none' : 'block';
                if (this.minimized) {
                    if (index !== 0) { // stack all nodes at the same location
                        nodeView.translate(this.nodes[0].position[0] + 130, this.nodes[0].position[1])
                    }
                }
                const firstOrLast = index === 0 || index === this.nodes.length - 1;
                if (this.minimized)
                    nodeView.setCustomClass(firstOrLast ? "sideGrouped" : "regularGrouped");
                else
                    nodeView.setCustomClass("");
                element.getConnections().forEach(con => {
                    const conView = (this.editor.view.connections.get(con)!);

                    if (!(firstOrLast)) {
                        conView.el.style.display = this.minimized ? "none" : "block";
                    }
                        conView.el.style.marginLeft = index === 0 && this.minimized ? "-30px" : ""
                    conView.update();
                })
            }
            this.update()
        }
        this._layouting = false;
    }

    update() {
        const bbox = nodesBBox(this.editor, this.nodes, 30);
        this.x = bbox.left;
        this.y = bbox.top;
        const scale = 1.0;
        this.el.style.transform = `translate(${this.x}px, ${this.y}px) scale(${scale})`;
        this.el.style.width = (this.minimized ? 160 : bbox.width) + 'px';
        this.el.style.backgroundColor = 'green'
        this.el.style.height = (this.minimized ? 160 : bbox.height) + 'px';

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


}