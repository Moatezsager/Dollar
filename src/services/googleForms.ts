/**
 * Google Forms and Drive API Client
 */

export interface GoogleDriveFormItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleFormQuestion {
  questionId: string;
  required?: boolean;
  choiceQuestion?: {
    type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
    options: Array<{ value: string }>;
  };
  textQuestion?: {
    paragraph?: boolean;
  };
  scaleQuestion?: {
    low: number;
    high: number;
    lowLabel?: string;
    highLabel?: string;
  };
}

export interface GoogleFormItem {
  itemId: string;
  title: string;
  description?: string;
  questionItem?: {
    question: GoogleFormQuestion;
  };
}

export interface GoogleFormDetails {
  formId: string;
  info: {
    title: string;
    description?: string;
    documentTitle?: string;
  };
  responderUri?: string;
  items?: GoogleFormItem[];
}

export interface GoogleFormResponseAnswer {
  questionId: string;
  textAnswers?: {
    answers: Array<{ value: string }>;
  };
}

export interface GoogleFormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, GoogleFormResponseAnswer>;
}

export interface GoogleFormResponsesResult {
  responses?: GoogleFormResponse[];
  nextPageToken?: string;
}

/**
 * List all Google Forms created in the user's Google Drive
 */
export async function listUserGoogleForms(accessToken: string): Promise<GoogleDriveFormItem[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.form' and trashed=false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `فشل جلب قائمة النماذج: ${res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Get full schema and questions of a specific Google Form
 */
export async function getGoogleFormDetails(formId: string, accessToken: string): Promise<GoogleFormDetails> {
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `فشل جلب تفاصيل النموذج: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Get all responses submitted to a specific Google Form
 */
export async function getGoogleFormResponses(formId: string, accessToken: string): Promise<GoogleFormResponsesResult> {
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `فشل جلب استجابات النموذج: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Create a new Google Form with predefined questions for Currency/Market polling
 */
export async function createGoogleForm(
  title: string,
  description: string,
  accessToken: string,
  items?: any[]
): Promise<GoogleFormDetails> {
  // Step 1: Create the form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'فشل إنشاء النموذج في Google Forms.');
  }

  const createdForm: GoogleFormDetails = await createRes.json();

  // Step 2: Add initial items / questions if provided
  if (items && items.length > 0) {
    const batchRequests = items.map((item, index) => ({
      createItem: {
        item,
        location: { index },
      },
    }));

    const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${createdForm.formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: batchRequests,
        includeFormInResponse: true,
      }),
    });

    if (updateRes.ok) {
      const updateData = await updateRes.json();
      if (updateData.form) {
        return updateData.form;
      }
    }
  }

  return createdForm;
}
