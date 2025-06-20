/** @param {NS} ns **/
import { Action, ChannelName } from "/Orchestrator/MessageManager/enum";
import { HACKING_SCRIPTS, HACKING_SERVER, IMPORT_TO_COPY, MANAGING_SERVER, PORT_CRACKER, } from "/Orchestrator/Config/Config";
import { MessageHandler, Payload } from "/Orchestrator/MessageManager/class";
import { copyFile } from "/Orchestrator/Common/GenericFunctions";
import { dprint } from "/Orchestrator/Common/Dprint";
export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("scp");
    ns.disableLog("scan");
    ns.disableLog("getHackingLevel");
    ns.disableLog("getServerRequiredHackingLevel");
    ns.disableLog("getServerNumPortsRequired");
    ns.disableLog("nuke");
    const mySelf = ChannelName.targetManager;
    const messageHandler = new MessageHandler(ns, mySelf);
    const currentHost = ns.getHostname();
    const hackedHost = [];
    let checkedHost = [];
    let portOpener = [];
    while (true) {
        dprint(ns, "Scanning network");
        portOpener = buildPortOpener();
        checkedHost = [];
        await scan_all(currentHost);
        dprint(ns, "Finshing scan. Waiting for next cycle.");
        for (let i = 0; i < 60; i++) {
            //if (await checkForKill(ns, messageHandler)) return
            await ns.sleep(1000);
        }
    }
    async function scan_all(base_host) {
        let hostArray = ns.scan(base_host);
        for (let i = 0; i < hostArray.length; i++) {
            const host = hostArray[i];
            if (!checkedHost.includes(host) && !host.includes("pserv-")) {
                checkedHost.push(host);
                if (checkHost(host) && !hackedHost.includes(host)) {
                    dprint(ns, "Found new host: " + host);
                    // We ns.rm before since there seems to be a bug with cached import: https://github.com/danielyxie/bitburner/issues/2413
                    if (host !== "home" && host !== HACKING_SERVER && host !== MANAGING_SERVER && !host.includes("pserv-")) {
                        await prepareServer(host);
                    }
                    hackedHost.push(host);
                    await broadcastNewHost(host);
                }
                await ns.sleep(100);
                await scan_all(host);
            }
        }
    }
    function checkHost(host) {
        if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host) && !ns.hasRootAccess(host)) {
            const requiredPort = ns.getServerNumPortsRequired(host);
            if (requiredPort <= portOpener.length) {
                // We have enough port cracker
                let portOpen = 0;
                while (portOpen < requiredPort) {
                    portOpener[portOpen](host);
                    portOpen++;
                }
            }
            else {
                // Not enough port cracker
                return false;
            }
            // Can be hacked
            ns.nuke(host);
            return true;
        }
        else if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host) && ns.hasRootAccess(host)) {
            // Already root
            return true;
        }
        else {
            // Not enough hacking level
            return false;
        }
    }
    async function broadcastNewHost(host) {
        dprint(ns, "Broadcasting host: " + host);
        const payload = new Payload(Action.addHost, host);
        dprint(ns, "Broadcasting to Thread Manager");
        await messageHandler.sendMessage(ChannelName.threadManager, payload);
        dprint(ns, "Broadcasting to Hack Manager");
        await messageHandler.sendMessage(ChannelName.hackManager, payload);
    }
    async function prepareServer(host) {
        await copyFile(ns, Object.values(HACKING_SCRIPTS), host);
        await copyFile(ns, IMPORT_TO_COPY, host);
    }
    function buildPortOpener() {
        const opener = [];
        for (let i = 0; i < PORT_CRACKER(ns).length; i++) {
            if (ns.fileExists(PORT_CRACKER(ns)[i].file)) {
                opener.push(PORT_CRACKER(ns)[i].function);
            }
        }
        return opener;
    }
}
