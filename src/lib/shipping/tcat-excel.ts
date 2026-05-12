import ExcelJS from 'exceljs';

export type ExcelOrderItem = {
  display_name: string;
  quantity: number;
  weight_g: number | null;
};

export type ExcelOrder = {
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string | null;
  desired_arrival_date: string | null;
  notes: string | null;
  payment_method: string | null;
  total_amount: string;
  items: ExcelOrderItem[];
};

export type FarmerInfo = {
  name: string;
  phone: string | null;
};

export async function generateTcatBatchExcel(
  orders: ExcelOrder[],
  farmer: FarmerInfo
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('批次出貨');

  const headers = [
    '收件人姓名', '收件人電話', '收件人地址',
    '寄件人姓名', '寄件人電話', '寄件人地址',
    '商品名稱', '件數', '重量(g)',
    '代收金額', '希望配達日期', '訂單備註',
  ];

  const colWidths = [12, 14, 32, 10, 14, 20, 36, 6, 10, 10, 14, 24];
  ws.columns = colWidths.map((width) => ({ width }));

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' },
  };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const order of orders) {
    // 黑貓批次表的「商品名稱」欄為品名，「件數」欄已分開帶總箱數。
    // 單品項時只寫品名（避免出現「大箱x3」這種冗餘）；多品項才合併寫
    // 「大箱×2、小箱×1」讓貨運人員一眼看出組合。
    const itemSummary =
      order.items.length === 1
        ? order.items[0].display_name
        : order.items.map((i) => `${i.display_name}×${i.quantity}`).join('、');
    const totalWeight = order.items.reduce(
      (sum, i) => sum + i.quantity * (i.weight_g ?? 0),
      0
    );
    const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const cod = order.payment_method === 'cod' ? Number(order.total_amount) : 0;
    const arrivalDate = order.desired_arrival_date
      ? order.desired_arrival_date.replace(/-/g, '/')
      : '';

    ws.addRow([
      order.recipient_name,
      order.recipient_phone,
      order.recipient_address ?? '',
      farmer.name,
      farmer.phone ?? '',
      '',
      itemSummary,
      totalQty,
      totalWeight,
      cod,
      arrivalDate,
      order.notes ?? '',
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
