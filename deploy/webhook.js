const http = require("http");
const { execSync } = require("child_process");
const crypto = require("crypto");

// GitHub Webhook Secret (set this in GitHub webhook settings)
const SECRET = process.env.WEBHOOK_SECRET || "your-secret-here";
const DEPLOY_SCRIPT = "/home/ubuntu/cloud-clipboard/deploy/auto-deploy.sh";
const PORT = 9000;

http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/deploy") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            // Verify GitHub signature
            const sig = req.headers["x-hub-signature-256"] || "";
            const hmac = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
            const expected = `sha256=${hmac}`;

            if (sig !== expected) {
                console.log(`[${new Date().toISOString()}] Invalid signature`);
                res.writeHead(403);
                res.end("Forbidden");
                return;
            }

            const payload = JSON.parse(body);
            
            // Only deploy on push to main branch
            if (payload.ref === "refs/heads/main") {
                console.log(`[${new Date().toISOString()}] Deploying: ${payload.head_commit?.message || "unknown"}`);
                try {
                    execSync(`bash ${DEPLOY_SCRIPT}`, { 
                        stdio: "inherit", 
                        timeout: 60000 
                    });
                    res.writeHead(200);
                    res.end("Deployed!");
                } catch (err) {
                    console.error("Deploy failed:", err.message);
                    res.writeHead(500);
                    res.end("Deploy failed");
                }
            } else {
                res.writeHead(200);
                res.end("Not main branch, skipping");
            }
        });
    } else {
        res.writeHead(200);
        res.end("Webhook listener running");
    }
}).listen(PORT, () => {
    console.log(`Webhook listener on port ${PORT}`);
});
