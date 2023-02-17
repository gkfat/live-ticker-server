import express, { Express } from 'express';
import http from 'http';
import { client, connection } from 'websocket';
import { CURRENCY } from 'node-bitstamp';
import { Server, Socket } from 'socket.io';
import { Interfaces } from './interfaces';
import cors from 'cors';
import path from 'path';

// Server Config
const app: Express = express();
const httpServer = new http.Server(app);
const PORT = 3000;

// External Connections
const WS_SERVER_BITSTAMP = 'wss://ws.bitstamp.net';

// Test WebSocket Client
app.use('/', express.static('public'));
app.get('/', (req: any, res: any) => res.sendFile(path.join(__dirname, '/public', 'index.html')));

// API Routes
const router = express.Router();

// CCY Subscription
const CCY_Subscription: Interfaces.Subscription[] = [];
const initCurrencySubscription = () => {
  const keys = Object.keys(CURRENCY);
  Object.values(CURRENCY).forEach((ticker, i) => {
    CCY_Subscription.push(new Interfaces.Subscription(keys[i], ticker as string));
  })
}

// WebSocket Server
const wsServer = new Server(httpServer, {
  path: '/streaming'
});
wsServer.on('connect', (socket: Socket) => {
  const address = socket.handshake.address;
  console.log(`Client ${address} connected`);

  // Pass Currency Pairs to client
  socket.emit('currency_pairs', CURRENCY);

  // Subscibe / Unsubscribe to Bitstamp live Tickers
  socket.on('subscribe', (userSubscribeList: Interfaces.IUserSubscribeList) => {
    if ( userSubscribeList.subscribeLists.length > 0 ) {
      userSubscribeList.subscribeLists.forEach(ticker => {
        const findRoom = CCY_Subscription.filter(s => s.ticker === ticker)[0];
        socket.join(ticker);
        console.log(`Address ${address} join room: ${ticker}`);
        if ( findRoom.latestTrade ) {
          socket.emit('streaming-message', {
            message: 'New Trade Info',
            channel: findRoom.ccy,
            trade: findRoom.latestTrade
          });
        }
      })
    }
    if ( userSubscribeList.unsubscribeLists.length > 0 ) {
      userSubscribeList.unsubscribeLists.forEach(ticker => {
        socket.leave(ticker);
        console.log(`Address ${address} leave room: ${ticker}`);
      })
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`Client: ${address} disconnected`);
  })
})


// Bitstamp
const wsClient = new client();
let bitstampConnection: connection;

wsClient.on('connectFailed', err => {
  console.log('Connect to Bitstamp WebSocket failed: ', err.toString());
})
wsClient.on('connect', connection => {
  bitstampConnection = connection;
  console.log('Connect to Bitstamp WebSocket success');

  BTSSubscribe();

  connection.on('message', message => {
    if (message.type === 'utf8') {
      // Parse Message
      const msg: Interfaces.IUTF8Data = JSON.parse(message.utf8Data);

      switch ( msg.event ) {
        case 'bts:subscription_succeeded':
          console.log(`Subscribe success: ${msg.channel}`);
          break;
        case 'bts:unsubscription_succeeded':
          console.log(`Unsubscribe success: ${msg.channel}`);
          break;
        case 'trade':
          const findSubscription = CCY_Subscription.filter(s => `live_trades_${s.ticker}` === msg.channel)[0];
          const tradeInfo = new Interfaces.TradeInfo({
            id: msg.data!.id,
            timestamp: msg.data!.timestamp,
            amount: msg.data!.amount,
            price: msg.data!.price,
            type: msg.data!.type === 0 ? 'B' : 'S',
            microtimestamp: msg.data!.microtimestamp,
            buy_order_id: msg.data!.buy_order_id,
            sell_order_id: msg.data!.sell_order_id,
          });
          findSubscription.latestTrade = tradeInfo;
          wsServer.to(findSubscription.ticker).emit('streaming-message', {
            message: 'New Trade Info',
            channel: findSubscription.ccy,
            trade: tradeInfo
          })
          break;
      }
    }
  });
})

// Subscribe all tickers live trade
const BTSSubscribe = () => {
  CCY_Subscription.forEach(subscription => {
    const subscribeMessage = {
      event: 'bts:subscribe',
      data: { channel: `live_trades_${subscription.ticker}` },
    };
    bitstampConnection.send(JSON.stringify(subscribeMessage));
  })
}

httpServer.listen(PORT, async () => {
    app.use(express.json({ limit: '50mb' }));
    app.set('trust proxy', true);
    app.use(cors());
    app.use(router);

    initCurrencySubscription();

    // Connect to Bitstamp websocket server
    wsClient.connect(WS_SERVER_BITSTAMP);

    console.log(`Server running on http://localhost:${PORT}`)
});