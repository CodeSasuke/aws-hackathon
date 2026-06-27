# SurveyIQ — AWS and Vercel Deployment Guide

This guide details how to configure your AWS infrastructure (S3 bucket, IAM user, and Bedrock model access) and link the Next.js 15 application to Vercel.

---

## 1. AWS S3 Bucket Configuration

To support direct-to-S3 Excel/CSV uploads from your browser, you must create an S3 bucket and configure its **CORS (Cross-Origin Resource Sharing)** rules.

### Steps:
1. Open the **AWS Console** and navigate to **S3**.
2. Click **Create bucket**. Name it (e.g., `surveyiq-uploads-yourname`) and choose your region (e.g., `ap-northeast-1`).
3. Under **Object Ownership**, select **ACLs disabled (recommended)**.
4. Keep **Block *all* public access** checked (direct uploads use secure presigned URLs; the bucket does not need to be public).
5. Click **Create bucket**.

### CORS Policy:
1. Open your new bucket, go to the **Permissions** tab, and scroll down to **Cross-origin resource sharing (CORS)**.
2. Click **Edit** and paste the following JSON:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://*.vercel.app"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```
3. Click **Save changes**.

---

## 2. AWS Bedrock Model Access

AWS Bedrock requires you to manually request model access before your API calls can invoke models.

### Steps:
1. Search for **Amazon Bedrock** in your AWS Console.
2. Ensure you are in a region that supports Bedrock Claude 3.5 Sonnet (e.g., **Tokyo `ap-northeast-1`** or **N. Virginia `us-east-1`**).
3. On the left sidebar, click **Model access** (near the bottom).
4. Click **Manage model access** in the top right.
5. Check the box next to **Anthropic -> Claude 3.5 Sonnet**.
6. Click **Save changes** (access is granted instantly for Claude 3.5 Sonnet).

---

## 3. AWS IAM User & Permissions

You need an IAM user access key to authenticate the backend API route with Bedrock and S3.

### Steps:
1. Open the **IAM Console** and click **Users** -> **Create user**.
2. Name the user `surveyiq-service-user` and click **Next**.
3. Under **Permissions options**, select **Attach policies directly**.
4. Click **Create policy**, switch to the **JSON** editor tab, and paste the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME_HERE/*"
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": "bedrock:InvokeModel",
            "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
        }
    ]
}
```
*(Replace `YOUR_BUCKET_NAME_HERE` with your actual S3 bucket name)*.
5. Save the policy as `SurveyIQPolicy`, return to the user creation screen, select it, and click **Next** -> **Create user**.
6. Open the newly created user, go to the **Security credentials** tab, and click **Create access key** (select "Local code" or "Other").
7. Copy your `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

---

## 4. Vercel Deployment

Deploying the Next.js frontend to Vercel is fully automated.

### Steps:
1. Commit and push your code to your GitHub repository:
   ```bash
   git push origin main
   ```
2. Log in to your **[Vercel Dashboard](https://vercel.com)**.
3. Click **Add New** -> **Project**.
4. Import your GitHub repository.
5. In the **Environment Variables** accordion, add the following variables from your `.env` file:
   * `DATABASE_URL` (pooled Supabase connection)
   * `DIRECT_URL` (direct Supabase connection)
   * `NEXTAUTH_SECRET` (generate a random string)
   * `NEXTAUTH_URL` (your production URL, or let Vercel handle it)
   * `AWS_ACCESS_KEY_ID`
   * `AWS_SECRET_ACCESS_KEY`
   * `AWS_REGION` (e.g. `ap-northeast-1`)
   * `AWS_S3_BUCKET` (e.g. `surveyiq-uploads-yourname`)
6. Click **Deploy**. Vercel will build and launch your application globally!
