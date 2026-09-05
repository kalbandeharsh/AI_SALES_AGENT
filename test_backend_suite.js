require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const connectDB = require("./src/config/db");
const app = require("./src/app");
const http = require("http");

async function runBackendVerification() {
    console.log("==================================================================");
    console.log("       ECHOSPHERE MERN BACKEND VERIFICATION SUITE                  ");
    console.log("==================================================================");

    await connectDB();

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(5099, resolve));
    console.log("✅ Test HTTP server listening on http://localhost:5099\n");

    const baseUrl = "http://localhost:5099";

    const fetchJson = async (url, options = {}) => {
        const res = await fetch(url, {
            ...options,
            headers: { "Content-Type": "application/json", ...options.headers }
        });
        return { status: res.status, data: await res.json() };
    };

    let passedTests = 0;
    let totalTests = 0;

    const assertTest = (testName, condition, details = "") => {
        totalTests++;
        if (condition) {
            passedTests++;
            console.log(`✅ PASS: ${testName}`);
            if (details) console.log(`   └─ ${details}`);
        } else {
            console.error(`❌ FAIL: ${testName}`);
            if (details) console.error(`   └─ ${details}`);
        }
    };

    try {
        // 1. Health check
        const health = await fetchJson(`${baseUrl}/`);
        assertTest("Health check endpoint (/)", health.status === 200 && health.data.status === "online", `Status: ${health.data.status}`);

        // 2. RAG Query: 200 users pricing
        const ragPricing = await fetchJson(`${baseUrl}/api/rag/query`, {
            method: "POST",
            body: JSON.stringify({ query: "What is the pricing for 200 users?", topK: 2 })
        });
        assertTest(
            "RAG Retrieval: 200 users pricing query",
            ragPricing.status === 200 && ragPricing.data.results.length > 0 && ragPricing.data.results[0].category === "pricing",
            `Top match score: ${ragPricing.data.results[0]?.score}, category: ${ragPricing.data.results[0]?.category}`
        );

        // 3. RAG Query: Competitor comparison
        const ragComp = await fetchJson(`${baseUrl}/api/rag/query`, {
            method: "POST",
            body: JSON.stringify({ query: "How do you compare to CompetitorX and Bland.ai?", topK: 2 })
        });
        assertTest(
            "RAG Retrieval: CompetitorX comparison query",
            ragComp.status === 200 && ragComp.data.results.some(r => r.category === "competitor"),
            `Retrieved ${ragComp.data.count} chunks, top score: ${ragComp.data.results[0]?.score}`
        );

        // 4. Pricing Calculation: 200 users
        const priceQuote = await fetchJson(`${baseUrl}/api/catalog/pricing/calculate`, {
            method: "POST",
            body: JSON.stringify({ userCount: 200, tier: "enterprise", billingCycle: "monthly" })
        });
        assertTest(
            "Deterministic Pricing Calculation for 200 users",
            priceQuote.status === 200 && priceQuote.data.quote.volumeDiscountApplied === "25%" && priceQuote.data.quote.monthlyTotal === 14850,
            `Monthly total: $${priceQuote.data.quote.monthlyTotal} (List: $19,800, Discount: ${priceQuote.data.quote.volumeDiscountApplied})`
        );

        // 5. Calendar Availability
        const calendarSlots = await fetchJson(`${baseUrl}/api/bookings/availability`);
        assertTest(
            "Calendar Slot Availability Check",
            calendarSlots.status === 200 && calendarSlots.data.slots.length > 0,
            `Total available slots: ${calendarSlots.data.totalAvailable} on ${calendarSlots.data.date}`
        );

        // 6. Calendar Booking Creation
        const bookingReq = await fetchJson(`${baseUrl}/api/bookings`, {
            method: "POST",
            body: JSON.stringify({
                title: "EchoSphere Demo with Acme Corp",
                startTime: new Date(Date.now() + 3600000).toISOString(),
                customerName: "Jane Doe",
                customerEmail: "jane@acme.org"
            })
        });
        assertTest(
            "Google Calendar Meeting Booking & Meet URL",
            bookingReq.status === 201 && bookingReq.data.meetingLink && bookingReq.data.meetingLink.includes("meet.google.com"),
            `Meeting link: ${bookingReq.data.meetingLink}, Appt ID: ${bookingReq.data.appointmentId}`
        );

        // 7. BANT Lead Scoring
        const leadScore = await fetchJson(`${baseUrl}/api/leads/score`, {
            method: "POST",
            body: JSON.stringify({
                userCount: 75,
                budgetMonthly: 5000,
                timeline: "immediate",
                authorityRole: "vp",
                needIntensity: "high"
            })
        });
        assertTest(
            "BANT Lead Scoring Engine",
            leadScore.status === 200 && leadScore.data.evaluation.score >= 80 && leadScore.data.evaluation.priority === "HIGH",
            `Score: ${leadScore.data.evaluation.score}/100, Priority: ${leadScore.data.evaluation.priority}`
        );

        // 8. Slack Escalation Webhook Dispatch
        const escalation = await fetchJson(`${baseUrl}/api/escalations`, {
            method: "POST",
            body: JSON.stringify({
                reason: "Customer requested enterprise custom volume contract terms",
                priority: "HIGH",
                contextSummary: "CTO asked for dedicated private VPC peering and HIPAA BAA.",
                stateFields: {
                    userCount: 200,
                    customerName: "John Smith",
                    qualificationScore: 88
                }
            })
        });
        assertTest(
            "Slack Escalation Webhook & MongoDB Logging",
            escalation.status === 201 && escalation.data.escalation && escalation.data.payload.blocks.length > 0,
            `Escalation ID: ${escalation.data.escalation._id}, Slack Dispatched: ${escalation.data.slackDispatched}`
        );

        // 9. Conversational Agent Turn with RAG Grounding
        const agentTurn = await fetchJson(`${baseUrl}/api/conversations/message`, {
            method: "POST",
            body: JSON.stringify({
                userMessage: "What is the cost for 200 users with annual billing?"
            })
        });
        assertTest(
            "Autonomous Agent Turn: Grounded Pricing Dialogue",
            agentTurn.status === 200 && agentTurn.data.reply.includes("200") && agentTurn.data.actionsTaken.length > 0,
            `Agent Reply: "${agentTurn.data.reply.substring(0, 100)}..."`
        );

    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        server.close();
        console.log(`\n==================================================================`);
        console.log(`VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
        console.log(`==================================================================`);
        process.exit(passedTests === totalTests ? 0 : 1);
    }
}

runBackendVerification();
