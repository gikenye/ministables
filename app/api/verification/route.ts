import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createProvider } from '@/lib/backend/utils';

const CELO_RPC_URL = process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org';
const SELF_CONTRACT_ADDRESS = '0xe57f4773bd9c9d8b6cd70431117d353298b9f5bf';

const DISCLOSURE_VERIFIED_EVENT_SIGNATURE = '0x14b70ae0a2b984327e9bcd235341661b8f8e6f4bb6d93a2c09707ca9d890cba2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get('userAddress');
  const chainId = searchParams.get('chainId');
  const chain = searchParams.get('chain');
  const contractAddress = searchParams.get('contractAddress');

  if (!userAddress) {
    return NextResponse.json({ error: 'User address is required' }, { status: 400 });
  }

  try {
    const chainParams = { chainId, chain };
    const provider = chainId || chain ? createProvider(chainParams) : createProvider(CELO_RPC_URL);
    const resolvedContract = contractAddress || SELF_CONTRACT_ADDRESS;
    
    // Filter by requestor address (topic 1 in DisclosureVerified event)
    const filter = {
      address: resolvedContract,
      topics: [
        DISCLOSURE_VERIFIED_EVENT_SIGNATURE,
        ethers.zeroPadValue(userAddress, 32) // requestor address
      ],
      fromBlock: -10000,
      toBlock: 'latest'
    };

    const logs = await provider.getLogs(filter);
    
    if (logs.length === 0) {
      return NextResponse.json({ error: 'No verification found' }, { status: 404 });
    }

    const latestLog = logs[logs.length - 1];
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256', 'bytes32', 'uint256', 'bytes', 'bytes'],
      latestLog.data
    );

    const outputBytes = decodedData[3];
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode([
      'tuple(bytes32,uint256,uint256,uint256[4],string,string[],string,string,string,string,string,uint256,bool[3])'
    ], outputBytes);

    const verificationData = decoded[0];
    
    const responseData = {
      attestationId: verificationData[0],
      userIdentifier: Number(verificationData[1]),
      nullifier: verificationData[2].toString(),
      forbiddenCountriesListPacked: verificationData[3].map((n: bigint) => Number(n)),
      nationality: verificationData[7],
      olderThan: Number(verificationData[11]),
      ofac: verificationData[12],
      transactionHash: latestLog.transactionHash,
      blockNumber: latestLog.blockNumber,
      timestamp: new Date().toISOString()
    };
    
    console.log('Verification Data:', JSON.stringify(responseData, null, 2));
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching verification data:', error);
    return NextResponse.json({ error: 'Failed to fetch verification data' }, { status: 500 });
  }
}
