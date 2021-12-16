import { CanvasNode } from './canvas-node';
import { CanvasConnectionArea } from './canvas-connection-area';
import { CanvasPoint } from './canvas-point';
import { CanvasConnection } from './canvas-connection';
import { ExpectedConnection } from './expected-connection';

export class ConnectionsOnCanvas {
  private connectionPointsByNodeId: Map<string, CanvasPoint[]>;
  private endPointsByBegin: Map<string, string[]> = new Map<string, string[]>();

  constructor(nodes: CanvasNode[], connectionAreas: CanvasConnectionArea[]) {
    this.connectionPointsByNodeId = new Map<string, CanvasPoint[]>();
    for (const node of nodes) {
      this.connectionPointsByNodeId.set(node.getId(), []);
    }
    for (const area of connectionAreas) {
      const areaCenter = area.getCenter();
      let foundId: string = '';
      for (const node of nodes) {
        if (areaCenter.atNode(node)) {
          if (foundId !== '') {
            throw new Error(
              `Connection area ${area.toString()} was already assigned to node ${foundId}`
            );
          } else {
            foundId = node.getId();
            this.connectionPointsByNodeId.get(foundId)?.push(areaCenter);
          }
          if (foundId === '') {
            throw new Error(
              `Connection area ${area.toString()} is not on a known node`
            );
          }
        }
      }
    }
    cy.log('Connection points by node id:');
    for (const [id, points] of this.connectionPointsByNodeId.entries())
      this.logPointsOfId(points, id);
    cy.log('End connection points by node id');
  }

  logPointsOfId(points: CanvasPoint[], id: string) {
    const pointsString: string = points.map((p) => p.toString()).join(', ');
    cy.log(`id: ${id}, points: ${pointsString}`);
  }

  public setCanvasConnections(connections: CanvasConnection[]): void {
    for (const conn of connections) {
      cy.log(
        `ConnectionsOnCanvas.setCanvasConnections() processes connection ${conn.toString()}`
      );
      let beginId: string = '';
      let endId: string = '';
      try {
        beginId = this.getId(conn.getBeginPoint());
      } catch (error) {
        cy.log(
          `Could not find node for begin point of connection ${conn.toString()}`
        );
        throw error;
      }
      try {
        endId = this.getId(conn.getEndPoint());
      } catch (error) {
        cy.log(
          `Could not find node for end point of connection ${conn.toString()}`
        );
        throw error;
      }
      if (this.endPointsByBegin.has(beginId)) {
        this.endPointsByBegin.get(beginId)?.push(endId);
      } else {
        this.endPointsByBegin.set(beginId, [endId]);
      }
    }
    cy.log(
      'ConnectionsOnCanvas.setCanvasConnections() endPointsByBegin has the following value:'
    );
    for (const [endNodes, beginNode] of this.endPointsByBegin) {
      cy.log(`  ${beginNode} ==> ${endNodes.toString()}`);
    }
  }

  public numConnections(): number {
    let result = 0;
    for (const beginNodes of this.endPointsByBegin.values()) {
      result += beginNodes.length;
    }
    return result;
  }

  public hasExpectedConnection(expected: ExpectedConnection): boolean {
    cy.log(`Checking expected connection ${expected.toString()}`);
    const expectedNode = expected.getTo();
    if (!this.endPointsByBegin.has(expected.getFrom())) {
      cy.log(`endPointsByBegin does not have ${expected.getFrom()}`);
      return false;
    }
    const actualEndNodes = this?.endPointsByBegin.get(expected.getFrom());
    let found = false;
    for (const endNode of actualEndNodes ?? []) {
      if (endNode === expectedNode) {
        found = true;
      }
    }
    cy.log(`Returning result ${found}`);
    return found;
  }

  private getId(point: CanvasPoint): string {
    let result: string = '';
    for (const [nodeId, connectionPoints] of this.connectionPointsByNodeId) {
      for (const connectionPoint of connectionPoints) {
        if (point.closeTo(connectionPoint)) {
          result = nodeId;
        }
      }
    }
    if (result === '') {
      throw new Error(
        `Point ${point.toString()} is not close to a node\'s connection point`
      );
    }
    return result;
  }
}
