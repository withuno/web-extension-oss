import moment from "moment";

// returns the id of the email
export async function gotEmailFromCurrentDomain(token: string) {
  const emailsResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=in:inbox",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (emailsResponse.status != 200) {
    console.log(emailsResponse);
    return { errorCode: emailsResponse.status, id: null };
  }

  const emails = await emailsResponse.json();
  const { id } = emails.messages[0];

  const emailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (emailResponse.status != 200) {
    console.log(emailResponse);
    return { errorCode: emailResponse.status, id: null };
  }

  const email = await emailResponse.json();

  let date = null;
  let fromEmail = null;

  for (let i = 0; i < email.payload.headers.length; i++) {
    const header = email.payload.headers[i];
    if (header.name === "Date") {
      date = header.value;
    } else if (header.name === "From") {
      fromEmail = header.value.substring(header.value.indexOf("<") + 1, header.value.lastIndexOf(">"));
    }
  }

  const domain = fromEmail.substring(fromEmail.lastIndexOf("@") + 1);
  const exp = moment(date);
  const minutesAgoRecieved = moment().diff(exp, "minutes");

  if (window.location.href.toLowerCase().includes(domain.toLowerCase()) && minutesAgoRecieved < 6) {
    return { errorCode: null, id };
  }

  return { id: null, errorCode: null };
}

export async function getMessages(token: string, index: number) {
  console.log("getting messages");
  const emailsResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (emailsResponse.status != 200) {
    return { errorCode: emailsResponse.status };
  }

  const emails = await emailsResponse.json();
  const { id } = emails.messages[index];

  const emailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (emailResponse.status != 200) {
    return { errorCode: emailResponse.status };
  }

  const email = await emailResponse.json();

  return { payload: email.payload, id: email.id, errorCode: null };
}

export async function archiveEmail(token: string, emailID: number) {
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailID}/modify`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
}

export function getBody(message: any) {
  let encodedBody = "";
  if (typeof message.parts === "undefined") {
    encodedBody = message.body.data;
  } else {
    encodedBody = getHTMLPart(message.parts);
  }
  encodedBody = encodedBody.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  return decodeURIComponent(escape(window.atob(encodedBody)));
}

function getHTMLPart(arr: any): any {
  for (let x = 0; x <= arr.length; x++) {
    if (typeof arr[x].parts === "undefined") {
      if (arr[x].mimeType === "text/html") {
        return arr[x].body.data;
      }
    } else {
      return getHTMLPart(arr[x].parts);
    }
  }
  return "";
}
