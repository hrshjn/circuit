// src/@types/langgraph.d.ts
declare module '@langchain/langgraph' {
  export class StateGraph<S> {
    constructor(opts?: any);
    addNode(name: string, fn: any): this;
    addEdge(from: string, to: string): this;
    setEntryPoint(name: string): this;
    addConditionalEdges(
      from: string,
      decide: (s: S) => string,
      map?: { [key: string]: string },
    ): this;
    compile(): {
      invoke: (s: S) => Promise<any>;
    };
  }
} 