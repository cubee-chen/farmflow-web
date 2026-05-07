'use server';
import { setCurrentFarmerId } from './farmer-context';

export async function setCurrentFarmerIdAction(farmerId: string) {
  await setCurrentFarmerId(farmerId);
}
