import { startOfficeCliService } from '../desktop-assistant/bridge/officecli-service.js';

const service = await startOfficeCliService({
    appName: 'Wally Office Assistant Dev Bridge',
    version: '0.1.0'
});

console.log(`OfficeCLI bridge listening on ${service.bridgeUrl}`);
console.log(`Health check: ${service.healthUrl}`);
console.log(`Workspace: ${service.workspace}`);

process.on('SIGINT', async () => {
    await service.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await service.stop();
    process.exit(0);
});
