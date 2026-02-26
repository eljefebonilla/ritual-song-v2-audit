"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/user-context";

interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface ContactFormData {
  contact_name: string;
  relationship: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

const EMPTY_FORM: ContactFormData = {
  contact_name: "",
  relationship: "",
  phone: "",
  email: "",
  is_primary: false,
};

const MAX_CONTACTS = 3;

export default function EmergencyContactsPage() {
  const { user } = useUser();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setContacts(data as EmergencyContact[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function updateField(field: keyof ContactFormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function startEdit(contact: EmergencyContact) {
    setEditingId(contact.id);
    setShowAddForm(false);
    setFormData({
      contact_name: contact.contact_name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      is_primary: contact.is_primary,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setShowAddForm(false);
    setFormData(EMPTY_FORM);
  }

  function startAdd() {
    setShowAddForm(true);
    setEditingId(null);
    setFormData({
      ...EMPTY_FORM,
      is_primary: contacts.length === 0,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    const supabase = createClient();

    // If setting as primary, unset all others first
    if (formData.is_primary) {
      await supabase
        .from("emergency_contacts")
        .update({ is_primary: false })
        .eq("user_id", user.id);
    }

    if (editingId) {
      // Update existing
      const { error } = await supabase
        .from("emergency_contacts")
        .update({
          contact_name: formData.contact_name,
          relationship: formData.relationship,
          phone: formData.phone,
          email: formData.email || null,
          is_primary: formData.is_primary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) {
        setToast({ type: "error", message: "Failed to update contact." });
      } else {
        setToast({ type: "success", message: "Contact updated." });
      }
    } else {
      // Insert new
      const { error } = await supabase.from("emergency_contacts").insert({
        user_id: user.id,
        contact_name: formData.contact_name,
        relationship: formData.relationship,
        phone: formData.phone,
        email: formData.email || null,
        is_primary: formData.is_primary,
      });

      if (error) {
        setToast({ type: "error", message: "Failed to add contact." });
      } else {
        setToast({ type: "success", message: "Emergency contact added." });
      }
    }

    setSaving(false);
    cancelEdit();
    fetchContacts();
  }

  async function handleDelete(id: string) {
    if (!user) return;
    const supabase = createClient();

    const { error } = await supabase
      .from("emergency_contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setToast({ type: "error", message: "Failed to delete contact." });
    } else {
      setToast({ type: "success", message: "Contact removed." });
    }
    setDeleteConfirmId(null);
    fetchContacts();
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-900 bg-white focus:outline-none focus:border-parish-burgundy focus:ring-1 focus:ring-parish-burgundy";

  function renderForm(isInline: boolean) {
    return (
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Contact Name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Contact Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contact_name}
              onChange={(e) => updateField("contact_name", e.target.value)}
              className={inputClass}
              placeholder="Full name"
              required
            />
          </div>

          {/* Relationship */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Relationship <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.relationship}
              onChange={(e) => updateField("relationship", e.target.value)}
              className={inputClass}
              placeholder="e.g. Spouse, Parent, Sibling"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              className={inputClass}
              placeholder="(555) 123-4567"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className={inputClass}
              placeholder="email@example.com"
            />
          </div>
        </div>

        {/* Primary Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_primary}
            onChange={(e) => updateField("is_primary", e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
          />
          <span className="text-sm text-stone-700">Primary emergency contact</span>
        </label>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-parish-burgundy text-white hover:bg-parish-burgundy/90 transition-colors disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Contact"
                : "Add Contact"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/3" />
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-stone-100 rounded-lg border border-stone-200"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Emergency Contacts
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">
              Up to {MAX_CONTACTS} emergency contacts. These will be available to music directors in case of emergency.
            </p>
          </div>
          {contacts.length < MAX_CONTACTS && !showAddForm && !editingId && (
            <button
              onClick={startAdd}
              className="px-4 py-1.5 text-sm font-medium text-parish-burgundy border border-parish-burgundy/30 rounded-lg hover:bg-parish-burgundy/5 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Contact
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Contact Cards */}
          {contacts.length === 0 && !showAddForm && (
            <div className="text-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-stone-300 mb-3">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="text-stone-500 text-sm">No emergency contacts added yet.</p>
              <button
                onClick={startAdd}
                className="mt-3 px-4 py-2 text-sm font-medium text-parish-burgundy border border-parish-burgundy/30 rounded-lg hover:bg-parish-burgundy/5 transition-colors"
              >
                Add Your First Contact
              </button>
            </div>
          )}

          {contacts.map((contact) => (
            <div key={contact.id}>
              {editingId === contact.id ? (
                /* Inline Edit Mode */
                <div className="bg-stone-50 rounded-lg border border-stone-200 p-4">
                  {renderForm(true)}
                </div>
              ) : (
                /* View Mode */
                <div className="bg-stone-50 rounded-lg border border-stone-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-stone-900">
                          {contact.contact_name}
                        </h3>
                        {contact.is_primary && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-parish-gold/20 text-parish-gold rounded-full border border-parish-gold/30">
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 mb-2">
                        {contact.relationship}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                        <span className="flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          {contact.phone}
                        </span>
                        {contact.email && (
                          <span className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="16" x="2" y="4" rx="2" />
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(contact)}
                        className="p-1.5 text-stone-400 hover:text-parish-burgundy hover:bg-white rounded transition-colors"
                        title="Edit contact"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>

                      {deleteConfirmId === contact.id ? (
                        <div className="flex items-center gap-1 ml-2">
                          <span className="text-xs text-red-600 mr-1">Delete?</span>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-xs font-medium text-stone-600 bg-stone-200 rounded hover:bg-stone-300 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(contact.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                          title="Delete contact"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add New Contact Form */}
          {showAddForm && (
            <div className="bg-stone-50 rounded-lg border border-stone-200 border-dashed p-4">
              <h3 className="text-sm font-medium text-stone-700 mb-3">
                New Emergency Contact
              </h3>
              {renderForm(false)}
            </div>
          )}

          {/* Limit notice */}
          {contacts.length >= MAX_CONTACTS && !editingId && (
            <p className="text-xs text-stone-400 text-center pt-2">
              Maximum of {MAX_CONTACTS} emergency contacts reached.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
