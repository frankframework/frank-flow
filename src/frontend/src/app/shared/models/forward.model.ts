export class Forward {
  private source: string;
  private destination: string;

  constructor(source: string, destination: string) {
    this.source = source;
    this.destination = destination;
  }

  public getSource(): string {
    return this.source;
  }

  public getDestination(): string {
    return this.destination;
  }
}
