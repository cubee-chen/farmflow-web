export async function dispatchNotification(params: {
  orderId: string;
  triggerEvent: 'confirmed' | 'paid' | 'shipped';
}) {
  // TODO: implemented in P1-N3
  console.log('[notify] queued:', params);
}
