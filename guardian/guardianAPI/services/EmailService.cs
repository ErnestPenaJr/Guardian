using System.Text.RegularExpressions;
using MailKit.Net.Smtp;
using AppSettings;
using Microsoft.Extensions.Options;
using MimeKit;
using Models;

namespace Services
{
    public partial class EmailService(
        ILogger<EmailService> Logger,
        IHttpContextAccessor HttpContextAccessor,
        IOptions<SmtpSettings> SmtpSettings,
        IWebHostEnvironment Env
    ) { 
        private readonly HttpContext HttpCtx = HttpContextAccessor.HttpContext!;
        private readonly SmtpSettings SmtpConfig = SmtpSettings.Value;

        public async Task SendEmail(EmailData? data) {
            if(data is null) return;

            try {
                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (p, o, a, l) => SmtpConfig.Bypass;
                MimeMessage? msg = null;

                if(!Env.IsProduction()) {
                    var lowerEnvRecipient = "jonathan@shieldlytics.com";
                    var newData = data with {
                        To = [lowerEnvRecipient],
                        Cc = [],
                        Body = $"{data.Body}<br><br><br> <ul> Original TO: Recipients {data.To.Select(t => $"<li>{t}</li>").DefaultIfEmpty(string.Empty).Aggregate((prev,next) => $"{prev}{next}")} </ul> <br> <ul> Original CC: Recipients {data.Cc.Select(t => $"<li>{t}</li>").DefaultIfEmpty(string.Empty).Aggregate((prev,next) => $"{prev}{next}")} </ul>",
                    };

                    Logger.LogDebug("Log outgoing email Message: {@EmailData}", newData with { Body = RemoveImages().Replace(newData.Body, "\"HEADER IMAGE TOKEN\"") });

                    msg = CreateEmail(newData);
                } else {
                    Logger.LogDebug("Log outgoing email Message: {@EmailData}", data with { Body = RemoveImages().Replace(data.Body, "\"HEADER IMAGE TOKEN\"") });
                    msg = CreateEmail(data);
                }

                await client.ConnectAsync(SmtpConfig.Host, SmtpConfig.Port, SmtpConfig.UseSsl);
                if(SmtpConfig.UseCredentials) {
                    await client.AuthenticateAsync(SmtpConfig.User, SmtpConfig.Password);
                }
                await client.SendAsync(msg);
                await client.DisconnectAsync(true);

            } catch (Exception e) {
                Logger.LogError(e, "Error sending email {Message}", e.Message);
                Logger.LogError("Log outgoing email message {@EmailData}", data with {Body = RemoveImages().Replace(data.Body, "\"HEADER IMAGE TOKEN\"") });
            }
        }

        private static MimeMessage CreateEmail (EmailData data) {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(string.Empty, data.From));
            message.To.AddRange(data.To.Select(email => new MailboxAddress(string.Empty, email)).ToList());
            message.Subject = data.Subject;

            if(data.Cc is not null && data.Cc.Count > 0){
                message.Cc.AddRange(data.Cc.Select(email => new MailboxAddress(string.Empty, email)).ToList());
            }

            var builder = new BodyBuilder {
                HtmlBody = data.Body
            };
            foreach(var attachment in data.Attachments ?? []) {
                var parsed = ContentType.TryParse(attachment.FileType, out var contentType);
                if(parsed) {
                    builder.Attachments.Add(attachment.FileName, attachment.FileData, contentType);
                }
            }

            message.Body = builder.ToMessageBody();

            return message;
        }

        [GeneratedRegex("\"data:image/png;base64,.*\"")]
        private static partial Regex RemoveImages();

    }

}