import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/shared/product-form';
import { createProduct } from '../actions';

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">新增商品</h1>
        <Button asChild variant="ghost">
          <Link href="/products">返回列表</Link>
        </Button>
      </div>
      <ProductForm action={createProduct} />
    </div>
  );
}
