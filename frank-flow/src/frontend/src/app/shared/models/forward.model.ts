export class Forward {
  private source: string;
  private destination: string;
  private name: string;

  constructor(source: string, destination: string, name: string) {
    this.source = source;
    this.destination = destination;
    this.name = name;
  }

  public getSource(): string {
    return this.source;
  }

  public getDestination(): string {
    return this.destination;
  }

  public getName(): string {
    return this.source;
  }
}
