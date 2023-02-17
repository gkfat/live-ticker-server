export namespace Interfaces {
  
  export class Subscription {
    ccy: string;
    ticker: string;
    latestTrade!: TradeInfo | null;

    constructor(ccy: string, ticker: string) {
      this.ccy = ccy;
      this.ticker = ticker;
    }
  }
  
  export interface IUserSubscribeList {
    subscribeLists: string[];
    unsubscribeLists: string[];
  }
  
  export interface IUTF8Data {
    event: string;
    channel: string;
    data?: TradeInfo;
  }

  export class TradeInfo {
    id: number;
    timestamp: string;
    amount: number;
    price: number;
    type: number;
    microtimestamp: string;
    buy_order_id: number;
    sell_order_id: number;

    constructor(param: any) {
      this.id = param.id;
      this.timestamp = param.timestamp;
      this.amount = param.amount;
      this.price = param.price;
      this.type = param.type;
      this.microtimestamp = param.microtimestamp;
      this.buy_order_id = param.buy_order_id;
      this.sell_order_id = param.sell_order_id;
    }
  }
}
