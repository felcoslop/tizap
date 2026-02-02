import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../db.js';
import { UPLOAD_DIR } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runDiskCleanup() {
    console.log('[CLEANUP] Starting disk cleanup check...');
    try {
        if (!fs.existsSync(UPLOAD_DIR)) {
            console.log('[CLEANUP] Upload directory does not exist, skipping.');
            return;
        }

        const files = fs.readdirSync(UPLOAD_DIR);
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // 1. Identify files older than 30 days
        const oldFiles = files.filter(file => {
            const filePath = path.join(UPLOAD_DIR, file);
            const stats = fs.statSync(filePath);
            return (now - stats.mtimeMs) > thirtyDaysMs;
        });

        if (oldFiles.length === 0) {
            console.log('[CLEANUP] No files older than 30 days found.');
            return;
        }

        console.log(`[CLEANUP] Found ${oldFiles.length} potential files to delete. Checking references...`);

        // 2. Fetch all flows and automations to check for references
        const flows = await prisma.flow.findMany({ select: { nodes: true } });
        const automations = await prisma.automation.findMany({ select: { nodes: true } });

        // Combine all node configurations into a single large string search block for efficiency
        const allConfigs = [
            ...flows.map(f => f.nodes),
            ...automations.map(a => a.nodes)
        ].join(' ');

        let deletedCount = 0;
        let sparedCount = 0;
        let totalFreed = 0;

        for (const file of oldFiles) {
            const filePath = path.join(UPLOAD_DIR, file);

            // Check if filename exists in any flow/automation node configuration
            // Match the filename exactly or as part of a URL
            if (allConfigs.includes(file)) {
                sparedCount++;
                continue;
            }

            // Not found in configs -> delete
            try {
                const stats = fs.statSync(filePath);
                totalFreed += stats.size;
                fs.unlinkSync(filePath);
                deletedCount++;
            } catch (err) {
                console.error(`[CLEANUP] Error deleting ${file}:`, err.message);
            }
        }

        const freedMb = (totalFreed / (1024 * 1024)).toFixed(2);
        console.log(`[CLEANUP] Finished. Deleted: ${deletedCount}, Spared (in use): ${sparedCount}, Freed: ${freedMb}MB`);

    } catch (err) {
        console.error('[CLEANUP ERROR]', err);
    }
}

export default { runDiskCleanup };
