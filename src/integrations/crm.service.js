const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const CRMAction = require("../models/CRMAction");

async function createContact(contactData) {
    try {
        const customer = await Customer.create(contactData);
        return { success: true, customer };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function createLead(leadData) {
    try {
        const lead = await Lead.create(leadData);
        await CRMAction.create({
            conversationId: lead.conversationId,
            actionType: "create_lead",
            payload: leadData,
            status: "success"
        });
        return { success: true, lead };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function updateLead(leadId, updates) {
    try {
        const lead = await Lead.findByIdAndUpdate(leadId, updates, { new: true });
        return { success: true, lead };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function addNote(conversationId, noteText) {
    try {
        const action = await CRMAction.create({
            conversationId,
            actionType: "add_note",
            payload: { note: noteText, timestamp: new Date() },
            status: "synced"
        });
        return { success: true, action };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function assignLead(leadId, assignedTo) {
    try {
        const lead = await Lead.findByIdAndUpdate(leadId, { assignedTo }, { new: true });
        return { success: true, lead };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    createContact,
    createLead,
    updateLead,
    addNote,
    assignLead
};