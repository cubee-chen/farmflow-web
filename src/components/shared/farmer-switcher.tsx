'use client';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setCurrentFarmerIdAction } from '@/lib/auth/actions';

type FarmerOption = { id: string; name: string; farm_name: string | null };

interface FarmerSwitcherProps {
  farmers: FarmerOption[];
  currentFarmerId: string;
}

export function FarmerSwitcher({ farmers, currentFarmerId }: FarmerSwitcherProps) {
  const router = useRouter();

  async function handleChange(farmerId: string) {
    await setCurrentFarmerIdAction(farmerId);
    router.refresh();
  }

  return (
    <Select value={currentFarmerId} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="選擇農友" />
      </SelectTrigger>
      <SelectContent>
        {farmers.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.farm_name ?? f.name}（{f.name}）
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
