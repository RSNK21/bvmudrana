// BV Mudrana — PageMaker 7 automation helper.
// Drives PageMaker over DDE (service "PageMaker"), PageMaker's documented automation interface:
// each step is a PageMaker script command (XTYP_EXECUTE) or query (XTYP_REQUEST).
// Usage: pmdde.exe <steps.tsv> <Pm70.exe> <output file> <log file>
// steps.tsv lines: kind \t flags \t var \t index \t command [\t alternative ...]
//   kind  X = command, Q = query (reply field <index> is stored in %var%)
//   flags t = failure is not an error, s = the save command
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class PmDde
{
    delegate IntPtr DdeCallback(uint uType, uint uFmt, IntPtr hconv, IntPtr hsz1, IntPtr hsz2, IntPtr hdata, IntPtr dwData1, IntPtr dwData2);
    [DllImport("user32.dll")] static extern uint DdeInitializeW(ref uint pidInst, DdeCallback pfnCallback, uint afCmd, uint ulRes);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr DdeCreateStringHandleW(uint idInst, string psz, int iCodePage);
    [DllImport("user32.dll")] static extern bool DdeFreeStringHandle(uint idInst, IntPtr hsz);
    [DllImport("user32.dll")] static extern IntPtr DdeConnect(uint idInst, IntPtr hszService, IntPtr hszTopic, IntPtr pCC);
    [DllImport("user32.dll")] static extern bool DdeDisconnect(IntPtr hConv);
    [DllImport("user32.dll")] static extern IntPtr DdeClientTransaction(byte[] pData, uint cbData, IntPtr hConv, IntPtr hszItem, uint wFmt, uint wType, uint dwTimeout, out uint pdwResult);
    [DllImport("user32.dll")] static extern uint DdeGetData(IntPtr hData, byte[] pDst, uint cbMax, uint cbOff);
    [DllImport("user32.dll")] static extern bool DdeFreeDataHandle(IntPtr hData);
    [DllImport("user32.dll")] static extern uint DdeGetLastError(uint idInst);
    [DllImport("user32.dll")] static extern bool DdeUninitialize(uint idInst);

    const uint APPCMD_CLIENTONLY = 0x10;
    const uint XTYP_EXECUTE = 0x4050;
    const uint XTYP_REQUEST = 0x20B0;
    const uint CF_TEXT = 1;
    const int CP_WINUNICODE = 1200;

    static uint inst;
    static IntPtr conv = IntPtr.Zero;
    static readonly DdeCallback keepAlive = (a, b, c, d, e, f, g, h) => IntPtr.Zero;
    static StreamWriter log;

    static void Log(string s) { try { log.WriteLine(DateTime.Now.ToString("HH:mm:ss.fff") + "  " + s); log.Flush(); } catch { } }
    static void Say(string s) { Console.WriteLine(s); Console.Out.Flush(); }

    static bool Connect()
    {
        if (inst == 0) { uint r = DdeInitializeW(ref inst, keepAlive, APPCMD_CLIENTONLY, 0); if (r != 0) { Log("DdeInitialize failed " + r); return false; } }
        IntPtr svc = DdeCreateStringHandleW(inst, "PageMaker", CP_WINUNICODE);
        IntPtr topic = DdeCreateStringHandleW(inst, "PageMaker", CP_WINUNICODE);
        conv = DdeConnect(inst, svc, topic, IntPtr.Zero);
        if (conv == IntPtr.Zero) conv = DdeConnect(inst, svc, IntPtr.Zero, IntPtr.Zero);
        DdeFreeStringHandle(inst, svc); DdeFreeStringHandle(inst, topic);
        return conv != IntPtr.Zero;
    }

    // A Unicode DDEML client sends Unicode text; DDEML turns it into ANSI for PageMaker.
    static string Exec(string cmd)
    {
        byte[] data = Encoding.Unicode.GetBytes(cmd + "\0");
        uint res;
        string c = cmd.ToLowerInvariant();
        uint timeout = c.StartsWith("import") || c.StartsWith("saveas") || c.StartsWith("new") || c.StartsWith("place") ? 300000u : 60000u;
        IntPtr h = DdeClientTransaction(data, (uint)data.Length, conv, IntPtr.Zero, 0, XTYP_EXECUTE, timeout, out res);
        if (h == IntPtr.Zero) return "ERR 0x" + DdeGetLastError(inst).ToString("X");
        return "OK";
    }

    static string Ask(string q)
    {
        IntPtr item = DdeCreateStringHandleW(inst, q, CP_WINUNICODE);
        uint res;
        IntPtr h = DdeClientTransaction(null, 0, conv, item, CF_TEXT, XTYP_REQUEST, 120000, out res);
        DdeFreeStringHandle(inst, item);
        if (h == IntPtr.Zero) return null;
        byte[] b = new byte[65536];
        uint n = DdeGetData(h, b, (uint)b.Length, 0);
        DdeFreeDataHandle(h);
        return Encoding.Default.GetString(b, 0, (int)Math.Min(n, (uint)b.Length)).TrimEnd('\0', '\r', '\n');
    }

    public static int Main(string[] args)
    {
        if (args.Length < 4) { Say("FAIL usage: pmdde steps.tsv Pm70.exe out log"); return 3; }
        string stepsPath = args[0], exe = args[1], outPath = args[2];
        log = new StreamWriter(args[3], false, new UTF8Encoding(false));
        Log("BV Mudrana PageMaker helper; PageMaker: " + exe);
        try
        {
            if (!Connect())
            {
                Say("MSG Starting PageMaker 7…");
                Log("PageMaker not running; starting it");
                try { Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(exe) }); }
                catch (Exception e) { Log("start failed: " + e.Message); Say("FAIL PageMaker could not be started: " + e.Message); return 2; }
                bool ok = false;
                for (int i = 0; i < 180; i++) { Thread.Sleep(1000); if (Connect()) { ok = true; break; } }
                if (!ok) { Say("FAIL PageMaker did not answer. Start PageMaker 7 yourself, close any dialog box it shows (registration, tips), then save again."); Log("no DDE answer after 180 s"); return 2; }
                Thread.Sleep(2500);
            }
            Log("connected");
            string[] lines = File.ReadAllLines(stepsPath, Encoding.UTF8);
            var vars = new Dictionary<string, string>();
            int errors = 0, n = lines.Length;
            for (int i = 0; i < n; i++)
            {
                string[] f = lines[i].Split(new char[] { '\t' });
                if (f.Length < 5) continue;
                string kind = f[0], flags = f[1], v = f[2], cmd = f[4];
                foreach (var kv in vars) cmd = cmd.Replace("%" + kv.Key + "%", kv.Value);
                if (i % 10 == 0 || flags.Contains("s")) Say("STEP " + (i + 1) + " " + n);
                if (kind == "Q")
                {
                    string reply = Ask(cmd);
                    Log("? " + cmd + "  =>  " + (reply ?? "(no reply)"));
                    int idx; int.TryParse(f[3], out idx);
                    if (reply != null) { string[] parts = reply.Split(new char[] { ',' }); if (parts.Length > idx) vars[v] = parts[idx].Trim().Trim('"'); }
                    continue;
                }
                string r = Exec(cmd);
                Log((r == "OK" ? "  " : "! ") + cmd + (r == "OK" ? "" : "  =>  " + r));
                for (int k = 5; r != "OK" && k < f.Length; k++)
                {
                    string alt = f[k];
                    foreach (var kv in vars) alt = alt.Replace("%" + kv.Key + "%", kv.Value);
                    r = Exec(alt);
                    Log((r == "OK" ? "  " : "! ") + alt + (r == "OK" ? "" : "  =>  " + r));
                }
                if (r == "ERR 0x4006") // DMLERR_EXECACKTIMEOUT: PageMaker is stuck, usually behind a message box
                {
                    Log("PageMaker stopped answering at: " + cmd);
                    Say("FAIL PageMaker stopped answering (it may be showing a message box). Look at the PageMaker window, close any message, and save again.");
                    return 5;
                }
                if (r != "OK" && !flags.Contains("t")) { errors++; Say("ERR " + (i + 1) + " " + cmd + " :: " + r); }
            }
            bool saved = File.Exists(outPath);
            Log(saved ? "saved " + outPath : "PageMaker did not write " + outPath);
            if (saved) Exec("close");
            Say("DONE " + errors);
            return saved ? 0 : 1;
        }
        catch (Exception e) { Log("crash: " + e); Say("FAIL " + e.Message); return 4; }
        finally { if (conv != IntPtr.Zero) DdeDisconnect(conv); if (inst != 0) DdeUninitialize(inst); try { log.Close(); } catch { } }
    }
}
