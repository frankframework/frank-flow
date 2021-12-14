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
    nodes.forEach((node) => {
      this.connectionPointsByNodeId.set(node.getId(), []);
    });
    connectionAreas.forEach((area) => {
      const areaCenter = area.getCenter();
      let foundId: string = '';
      nodes.forEach((node) => {
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
      });
    });
    cy.log('Connection points by node id:');
    this.connectionPointsByNodeId.forEach((points, id) =>
      this.logPointsOfId(points, id)
    );
    cy.log('End connection points by node id');
  }

  logPointsOfId(points: CanvasPoint[], id: string) {
    const pointsStr: string = points.map((p) => p.toString()).join(', ');
    cy.log(`id: ${id}, points: ${pointsStr}`);
  }

  public setCanvasConnections(connections: CanvasConnection[]): void {
    connections.forEach((conn) => {
      cy.log(
        `ConnectionsOnCanvas.setCanvasConnections() processes connection ${conn.toString()}`
      );
      let beginId: string = '';
      let endId: string = '';
      try {
        beginId = this.getId(conn.getBeginPoint());
      } catch (e) {
        cy.log(
          `Could not find node for begin point of connection ${conn.toString()}`
        );
        throw e;
      }
      try {
        endId = this.getId(conn.getEndPoint());
      } catch (e) {
        cy.log(
          `Could not find node for end point of connection ${conn.toString()}`
        );
        throw e;
      }
      if (this.endPointsByBegin.has(beginId)) {
        this.endPointsByBegin.get(beginId)?.push(endId);
      } else {
        this.endPointsByBegin.set(beginId, [endId]);
      }
    });
    cy.log(
      'ConnectionsOnCanvas.setCanvasConnections() endPointsByBegin has the following value:'
    );
    this.endPointsByBegin.forEach((endNodes: string[], beginNode: string) => {
      cy.log(`  ${beginNode} ==> ${endNodes.toString()}`);
    });
  }

  public numConnections(): number {
    let result = 0;
    this.endPointsByBegin.forEach((endNodes: string[], beginNode: string) => {
      result += endNodes.length;
    });
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
    actualEndNodes?.forEach((endNode) => {
      if (endNode === expectedNode) {
        found = true;
      }
    });
    cy.log(`Returning result ${found}`);
    return found;
  }

  private getId(point: CanvasPoint): string {
    let result: string = '';
    this.connectionPointsByNodeId.forEach(
      (connectionPoints: CanvasPoint[], nodeId: string) => {
        connectionPoints.forEach((connectionPoint) => {
          if (point.closeTo(connectionPoint)) {
            result = nodeId;
          }
        });
      }
    );
    if (result === '') {
      throw new Error(
        `Point ${point.toString()} is not close to a node\'s connection point`
      );
    }
    return result;
  }
}
