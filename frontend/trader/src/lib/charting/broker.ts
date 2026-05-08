/**
 * TradingView Trading Terminal Broker Adapter.
 *
 * Connects TradingView's built-in order panel to our trading API.
 * Implements IBrokerTerminal: placeOrder, modifyOrder, cancelOrder,
 * orders(), positions(), accountManagerInfo(), etc.
 */
import { useTradingStore } from '@/stores/tradingStore';
import api from '@/lib/api/client';

/* ─── TV Enums (mirrored from charting_library.d.ts) ─── */
const OrderSide = { Buy: 1, Sell: -1 } as const;
const OrderType = { Market: 1, Limit: 2, Stop: 3, StopLimit: 4 } as const;
const OrderStatus = { Canceled: 1, Filled: 2, Inactive: 3, Placing: 4, Rejected: 5, Working: 6 } as const;
const ParentType = { Order: 1, Position: 2 } as const;
const ConnectionStatus = { Connected: 1, Connecting: 2, Disconnected: 3, Error: 4 } as const;

let _host: any = null;
let _currentAccountId = '';

function getActiveAccount() {
  return useTradingStore.getState().activeAccount;
}

function getPositions() {
  return useTradingStore.getState().positions;
}

function getPrices() {
  return useTradingStore.getState().prices;
}

export function createBroker(host: any): any {
  _host = host;
  const acc = getActiveAccount();
  _currentAccountId = acc?.id || '';

  // Poll positions and push updates to TV every 3s. Includes stopLoss /
  // takeProfit so TradingView's chart auto-renders the SL/TP horizontal
  // lines + the entry-price line for every open position. Without those
  // fields the chart silently omits the lines (no error; just no draw).
  setInterval(async () => {
    try {
      const acc = getActiveAccount();
      if (!acc) return;
      const positions = getPositions();
      const prices = getPrices();

      for (const pos of positions) {
        const tick = prices[pos.symbol];
        const cp = tick ? (pos.side === 'buy' ? tick.bid : tick.ask) : undefined;
        _host?.positionUpdate({
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          qty: pos.lots,
          avgPrice: pos.open_price,
          unrealizedPl: pos.profit || 0,
          ...(cp != null ? { last: cp } : {}),
          // Surface SL/TP as fields TV's chart layer recognises so it
          // draws the dashed horizontal lines automatically.
          ...(pos.stop_loss != null ? { stopLoss: pos.stop_loss } : {}),
          ...(pos.take_profit != null ? { takeProfit: pos.take_profit } : {}),
        });
      }
    } catch {}
  }, 3000);

  return {
    /* ─── Connection ─── */
    connectionStatus(): number {
      return ConnectionStatus.Connected;
    },

    /* ─── Account ─── */
    accountsMetainfo(): Promise<any[]> {
      const acc = getActiveAccount();
      if (!acc) return Promise.resolve([]);
      return Promise.resolve([{
        id: acc.id,
        name: `${acc.account_number} (${acc.is_demo ? 'Demo' : 'Live'})`,
        currency: acc.currency || 'USD',
      }]);
    },

    currentAccount(): string {
      return _currentAccountId || getActiveAccount()?.id || '';
    },

    setCurrentAccount(accountId: string) {
      _currentAccountId = accountId;
    },

    accountManagerInfo(): any {
      const acc = getActiveAccount();
      return {
        accountTitle: 'Trading',
        summary: [
          { text: 'Balance', wValue: acc?.balance ?? 0, formatter: 'fixed', isDefault: true },
          { text: 'Equity', wValue: acc?.equity ?? 0, formatter: 'fixed' },
          { text: 'P&L', wValue: 0, formatter: 'profit' },
        ],
        orderColumns: [
          { label: 'Symbol', id: 'symbol', dataFields: ['symbol'] },
          { label: 'Side', id: 'side', dataFields: ['side'], formatter: 'side' },
          { label: 'Qty', id: 'qty', dataFields: ['qty'], formatter: 'fixed' },
          { label: 'Price', id: 'limitPrice', dataFields: ['limitPrice'], formatter: 'formatPrice' },
          { label: 'Status', id: 'status', dataFields: ['status'], formatter: 'status' },
        ],
        positionColumns: [
          { label: 'Symbol', id: 'symbol', dataFields: ['symbol'] },
          { label: 'Side', id: 'side', dataFields: ['side'], formatter: 'side' },
          { label: 'Qty', id: 'qty', dataFields: ['qty'], formatter: 'fixed' },
          { label: 'Avg Price', id: 'avgPrice', dataFields: ['avgPrice'], formatter: 'formatPrice' },
          { label: 'P&L', id: 'pl', dataFields: ['pl'], formatter: 'profit' },
        ],
      };
    },

    /* ─── Orders ─── */
    async orders(): Promise<any[]> {
      const acc = getActiveAccount();
      if (!acc) return [];
      try {
        const res = await api.get<any>(`/orders/?account_id=${acc.id}&status=pending`);
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        return items.map((o: any) => ({
          id: o.id,
          symbol: o.symbol,
          side: o.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          type: o.order_type === 'limit' ? OrderType.Limit : o.order_type === 'stop' ? OrderType.Stop : OrderType.Market,
          qty: o.lots,
          limitPrice: o.price,
          stopPrice: o.stop_price,
          status: OrderStatus.Working,
          filledQty: 0,
        }));
      } catch {
        return [];
      }
    },

    /* ─── Positions ─── */
    async positions(): Promise<any[]> {
      const positions = getPositions();
      const prices = getPrices();
      return positions.map((p) => {
        const tick = prices[p.symbol];
        const cp = tick ? (p.side === 'buy' ? tick.bid : tick.ask) : p.current_price || p.open_price;
        return {
          id: p.id,
          symbol: p.symbol,
          side: p.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          qty: p.lots,
          avgPrice: p.open_price,
          unrealizedPl: p.profit || 0,
          last: cp,
          // Required for TV to draw SL / TP horizontal lines on the chart.
          ...(p.stop_loss != null ? { stopLoss: p.stop_loss } : {}),
          ...(p.take_profit != null ? { takeProfit: p.take_profit } : {}),
        };
      });
    },

    async executions(symbol: string): Promise<any[]> {
      // Returning fills here lets TV draw entry markers (triangle/circle)
      // on the candle where the position opened — so the trader can see
      // exactly when and at what price they entered, in addition to the
      // horizontal entry-price line that the position rendering provides.
      const positions = getPositions().filter((p) => p.symbol === symbol);
      return positions.map((p) => ({
        symbol: p.symbol,
        price: p.open_price,
        time: new Date(p.opened_at || p.created_at || Date.now()).getTime(),
        side: p.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
        qty: p.lots,
      }));
    },

    /* ─── Trade Actions ─── */
    async placeOrder(order: any): Promise<any> {
      const acc = getActiveAccount();
      if (!acc) throw new Error('No active account');

      const sym = order.symbol?.includes(':') ? order.symbol.split(':').pop() : order.symbol;
      const side = order.side === OrderSide.Buy ? 'buy' : 'sell';
      const isMarket = order.type === OrderType.Market;

      const body: any = {
        account_id: acc.id,
        symbol: sym,
        side,
        order_type: isMarket ? 'market' : order.type === OrderType.Limit ? 'limit' : 'stop',
        lots: order.qty,
      };
      if (!isMarket && order.limitPrice) body.price = order.limitPrice;
      if (order.stopPrice) body.stop_price = order.stopPrice;
      if (order.stopLoss) body.stop_loss = order.stopLoss;
      if (order.takeProfit) body.take_profit = order.takeProfit;

      try {
        const res = await api.post<any>('/orders/', body);
        const orderId = res?.id || res?.order_id || `tv_${Date.now()}`;

        if (isMarket && res?.position_id) {
          // Market order filled immediately → show as position. avgPrice
          // must be the actual fill price (returned by the API), NOT
          // order.limitPrice (which is meaningless for a market order).
          // Wrong avgPrice produced incorrect entry-price lines on chart.
          const fillPx = res?.filled_price || res?.fill_price || res?.avg_price || res?.price || 0;
          _host?.orderUpdate({
            id: orderId,
            symbol: sym,
            side: order.side,
            type: OrderType.Market,
            qty: order.qty,
            status: OrderStatus.Filled,
            filledQty: order.qty,
            avgPrice: fillPx,
          });

          // Refresh positions from store
          setTimeout(() => {
            void 0 /* positions update via WS */;
          }, 500);
        }

        return { orderId };
      } catch (e: any) {
        _host?.showNotification?.('Order Failed', e?.message || 'Could not place order', 0);
        throw e;
      }
    },

    async modifyOrder(order: any): Promise<void> {
      try {
        const body: any = {};
        if (order.limitPrice != null) body.price = order.limitPrice;
        if (order.stopPrice != null) body.stop_price = order.stopPrice;
        if (order.qty != null) body.lots = order.qty;
        await api.put(`/orders/${order.id}`, body);
        _host?.orderUpdate({ ...order, status: OrderStatus.Working });
      } catch (e: any) {
        _host?.showNotification?.('Modify Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    async cancelOrder(orderId: string): Promise<void> {
      try {
        await api.delete(`/orders/${orderId}`);
        _host?.orderUpdate({ id: orderId, status: OrderStatus.Canceled });
      } catch (e: any) {
        _host?.showNotification?.('Cancel Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    async closePosition(positionId: string): Promise<void> {
      try {
        await api.post(`/positions/${positionId}/close`, {});
        _host?.positionUpdate({ id: positionId, qty: 0 });
        setTimeout(() => {
          void 0 /* positions update via WS */;
        }, 500);
      } catch (e: any) {
        _host?.showNotification?.('Close Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    async reversePosition(positionId: string): Promise<void> {
      // Not supported
    },

    /* ─── Tradability ─── */
    isTradable(symbol: string): Promise<boolean> {
      return Promise.resolve(true);
    },

    chartContextMenuActions(): Promise<any[]> {
      return Promise.resolve([]);
    },

    /* ─── Config ─── */
    brokerConfig(): any {
      return {
        configFlags: {
          supportOrderBrackets: false,
          supportPositionBrackets: true,    // SL/TP attached to position
          supportClosePosition: true,
          supportReversePosition: false,
          supportNativeReversePosition: false,
          supportMarketOrders: true,
          supportLimitOrders: true,
          supportStopOrders: true,
          supportStopLimitOrders: false,
          supportModifyOrder: true,
          supportCancelOrder: true,
          supportEditAmount: true,
          showQuantityInsteadOfAmount: true,
          supportLevel2Data: false,
          // Required for TV to render the entry / SL / TP horizontal lines
          // + execution markers on the chart. Without these flags TV
          // silently skips the draw even when positions() returns SL/TP.
          showNotificationsLog: true,
          supportPLUpdate: true,
          supportPositionNetting: false,
          positionPLInInstrumentCurrency: false,
        },
        durations: [],
      };
    },

    quantityFormatter(symbol: string) {
      return {
        format: (qty: number) => qty.toFixed(2),
        parse: (str: string) => parseFloat(str) || 0.01,
      };
    },
  };
}
