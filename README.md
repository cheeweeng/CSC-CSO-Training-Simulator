# AI-Powered CSO Training Simulator

An advanced, AI-driven training platform designed for Customer Service Officers (CSOs) to practice handling complex customer inquiries within a safe, simulated environment. The platform leverages the Gemini AI model to generate realistic scenarios and provide instant, bias-free, competency-based feedback.

## 🚀 Key Features

### For CSOs (Independent Practice)
- **AI-Generated Scenarios:** Practice with diverse, realistic customer inquiries generated on-the-fly by AI.
- **Internal Policy Context:** Every scenario includes relevant internal policy snippets to ensure practice remains grounded in organizational rules.
- **Real-time Evaluation:** Receive immediate, [detailed feedback across five core competencies](https://github.com/user-attachments/assets/b1790498-6932-46f5-a5a5-c9500b7cfc8b):
  - Policy Translation
  - Empathy
  - WOG (Whole-of-Government) Perspective
  - Integrity
  - Problem Ownership
- **Progress Tracking:** Personal dashboard to monitor practice history and score trends over time.
<img width="700" height="500" alt="scenarios dashboard" src="https://github.com/user-attachments/assets/d6fa5d65-779f-48e6-9b92-c9725f7244c3" />

### For CX Managers (Team Dashboard)
- **Organization-wide Analytics:** Aggregate data on total sessions, average scores, and completion rates.
- **Competency Gap Analysis:** Visual bar charts identifying which core competencies the team needs more training in.
- **Individual CSO Metrics:** Detailed performance table tracking sessions, completion rates, and average scores for every team member.
- **Scenario Management:** Ability to regenerate training scenarios to keep content fresh and relevant.
<img width="700" height="500" alt="CX dashboard" src="https://github.com/user-attachments/assets/bff78aad-d2eb-4e82-bc6e-6703c4e8544c" />

## 🛠 Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS
- **Database & Auth:** Firebase (Firestore & Authentication)
- **AI Engine:** Google Gemini AI (`@google/genai`)
- **Visualizations:** Recharts (D3-based)
- **Animations:** Framer Motion
- **Icons:** Lucide React

## 🏁 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A Firebase Project
- A Google AI Studio API Key (for Gemini)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/cx-training-simulator.git
   cd cx-training-simulator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory and add the following:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `src/components/`: Reusable UI components (Buttons, Cards, Badges, etc.)
- `src/lib/`: Core logic including Firebase configuration and AI service wrappers.
- `src/types.ts`: TypeScript interfaces for Scenarios, Sessions, and User Profiles.
- `src/App.tsx`: Main application logic and routing.
- `firestore.rules`: Security rules for protecting user and session data.

## 🛡 Security

The project uses Firebase Security Rules to ensure:
- CSOs can only read/write their own practice sessions.
- Only Admins (Managers) can access organization-wide analytics and user profiles.
- Strict data validation for all AI evaluations and scores.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
