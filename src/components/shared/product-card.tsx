'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toggleProductActive } from '@/app/(app)/products/actions';
import type { Product } from '@/lib/db/schema';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isActive, setIsActive] = useState(product.is_active ?? true);

  async function handleToggle(checked: boolean) {
    setIsActive(checked);
    try {
      await toggleProductActive(product.id);
    } catch {
      setIsActive(!checked);
    }
  }

  return (
    <Card className={isActive ? '' : 'opacity-60'}>
      <CardContent className="p-4 flex flex-col gap-2">
        {/* Row 1: name + price / switch */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-bold">{product.display_name}</span>
            <span className="ml-2 text-sm text-zinc-600">
              NT${Number(product.price).toLocaleString()}
            </span>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={handleToggle}
            aria-label={isActive ? '下架商品' : '上架商品'}
          />
        </div>

        {/* Row 2: description */}
        {product.description && (
          <p className="text-sm text-zinc-500">{product.description}</p>
        )}

        {/* Row 3: aliases */}
        {product.short_aliases && product.short_aliases.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.short_aliases.map((alias) => (
              <Badge key={alias} variant="secondary" className="text-xs">
                {alias}
              </Badge>
            ))}
          </div>
        )}

        {/* Row 4: weight + edit */}
        <div className="flex items-center justify-between mt-1">
          {product.weight_g != null ? (
            <span className="text-xs text-zinc-500">黑貓重量：{product.weight_g} g</span>
          ) : (
            <span />
          )}
          <Button asChild variant="outline" size="sm" className="min-h-[44px] text-sm">
            <Link href={`/products/${product.id}/edit`}>編輯</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
