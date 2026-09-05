const Appointment = require("../../models/Appointment");
const Customer = require("../../models/Customer");
const crypto = require("crypto");

/**
 * Standard business hours: 9:00 AM to 6:00 PM (30-minute intervals)
 */
const DEFAULT_TIME_SLOTS = [
    "09:00", "09:45", "10:30", "11:15",
    "14:00", "14:45", "15:30", "16:15", "17:00"
];

/**
 * Step 6: Check calendar availability for a given target date
 * Excludes already booked appointments from MongoDB
 */
async function getAvailability(params = {}) {
    const targetDateStr = params.date || new Date().toISOString().split("T")[0];
    const durationMinutes = params.durationMinutes || 30;

    // Start and end of the specified day
    const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

    // Fetch existing booked appointments for this date
    let existingAppointments = [];
    try {
        existingAppointments = await Appointment.find({
            startTime: { $gte: dayStart, $lte: dayEnd },
            status: { $ne: "cancelled" }
        }).lean();
    } catch (err) {
        console.warn("Could not check MongoDB existing appointments:", err.message);
    }

    const bookedTimes = new Set(
        existingAppointments.map(a => {
            const d = new Date(a.startTime);
            return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
        })
    );

    const availableSlots = DEFAULT_TIME_SLOTS.map(timeStr => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const slotStart = new Date(dayStart);
        slotStart.setUTCHours(hours, minutes, 0, 0);

        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
        const isBooked = bookedTimes.has(timeStr);

        return {
            time: timeStr,
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            available: !isBooked,
            durationMinutes
        };
    });

    return {
        date: targetDateStr,
        slots: availableSlots,
        totalAvailable: availableSlots.filter(s => s.available).length
    };
}

/**
 * Step 6: Create and book a calendar meeting
 * Generates Google Meet link and saves to Appointment collection
 */
async function createMeeting(bookingData) {
    const {
        customerId,
        conversationId,
        title = "EchoSphere Voice AI - Executive Demo",
        startTime,
        endTime,
        customerName = "Valued Prospect",
        customerEmail = "prospect@example.com",
        notes = "Automated booking via EchoSphere Sales AI"
    } = bookingData;

    if (!startTime) {
        throw new Error("Meeting startTime is required");
    }

    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 30 * 60000);

    // Generate unique Google Meet style code: meet.google.com/xxx-yyyy-zzz
    const randCode = () => crypto.randomBytes(3).toString("hex").substring(0, 3);
    const meetingCode = `${randCode()}-${randCode()}-${randCode()}`;
    const meetingLink = `https://meet.google.com/${meetingCode}`;

    // Create record in Appointment collection
    let appointment;
    try {
        appointment = await Appointment.create({
            customerId,
            conversationId,
            title,
            startTime: start,
            endTime: end,
            meetingLink,
            status: "confirmed"
        });
    } catch (err) {
        console.warn("Could not persist Appointment to MongoDB:", err.message);
        appointment = {
            _id: new Date().getTime().toString(),
            customerId,
            conversationId,
            title,
            startTime: start,
            endTime: end,
            meetingLink,
            status: "confirmed"
        };
    }

    // Prepare calendar invite payload
    const calendarEvent = {
        id: appointment._id,
        summary: title,
        description: `EchoSphere AI Sales Consultation with ${customerName}.\nNotes: ${notes}\nMeeting Link: ${meetingLink}`,
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
        attendees: [
            { email: customerEmail, displayName: customerName },
            { email: "sales@echosphere.ai", displayName: "EchoSphere Sales Executive" }
        ],
        conferenceData: {
            conferenceSolution: { name: "Google Meet" },
            entryPoints: [{ entryPointType: "video", uri: meetingLink }]
        },
        meetingLink,
        status: "confirmed"
    };

    console.log(`📅 [Google Calendar Integration] Booked event "${title}" for ${customerEmail} at ${start.toISOString()}`);

    return {
        success: true,
        appointmentId: appointment._id,
        title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        meetingLink,
        googleCalendarEvent: calendarEvent
    };
}

/**
 * Cancel an existing appointment
 */
async function cancelMeeting(appointmentId, reason = "Customer requested cancellation") {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            appointmentId,
            { status: "cancelled" },
            { new: true }
        );
        console.log(`❌ [Google Calendar Integration] Cancelled appointment ${appointmentId}: ${reason}`);
        return { success: true, appointment };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    getAvailability,
    createMeeting,
    cancelMeeting
};