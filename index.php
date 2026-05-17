<?php
session_start();

const USER_STORAGE_PATH = __DIR__ . '/data/users.json';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$errors = [];
$successMessage = '';
$input = [
    'full_name' => '',
    'email' => '',
];

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function registerUser(string $fullName, string $email, string $password): ?string
{
    $directory = dirname(USER_STORAGE_PATH);

    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        return 'Unable to create the registration storage directory.';
    }

    $file = fopen(USER_STORAGE_PATH, 'c+');
    if ($file === false) {
        return 'Unable to open the registration storage file.';
    }

    if (!flock($file, LOCK_EX)) {
        fclose($file);
        return 'Unable to lock the registration storage file.';
    }

    rewind($file);
    $rawUsers = stream_get_contents($file);
    $users = $rawUsers ? json_decode($rawUsers, true) : [];

    if (!is_array($users)) {
        flock($file, LOCK_UN);
        fclose($file);
        return 'Registration storage is not valid JSON.';
    }

    $normalizedEmail = strtolower($email);
    foreach ($users as $user) {
        if (($user['email'] ?? '') === $normalizedEmail) {
            flock($file, LOCK_UN);
            fclose($file);
            return 'An account with this email already exists.';
        }
    }

    $users[] = [
        'id' => bin2hex(random_bytes(16)),
        'full_name' => $fullName,
        'email' => $normalizedEmail,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'created_at' => gmdate('c'),
    ];

    rewind($file);
    ftruncate($file, 0);
    fwrite($file, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    fflush($file);
    flock($file, LOCK_UN);
    fclose($file);

    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input['full_name'] = trim($_POST['full_name'] ?? '');
    $input['email'] = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';
    $acceptedTerms = isset($_POST['terms']);
    $postedToken = $_POST['csrf_token'] ?? '';

    if (!hash_equals($_SESSION['csrf_token'], $postedToken)) {
        $errors[] = 'Your session expired. Please submit the form again.';
    }

    if ($input['full_name'] === '' || strlen($input['full_name']) < 2) {
        $errors[] = 'Full name must be at least 2 characters.';
    }

    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Enter a valid email address.';
    }

    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }

    if ($password !== $confirmPassword) {
        $errors[] = 'Password and confirmation must match.';
    }

    if (!$acceptedTerms) {
        $errors[] = 'You must accept the terms to register.';
    }

    if ($errors === []) {
        $storageError = registerUser($input['full_name'], $input['email'], $password);

        if ($storageError === null) {
            $successMessage = 'Registration successful. You can now sign in with your email.';
            $input = ['full_name' => '', 'email' => ''];
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        } else {
            $errors[] = $storageError;
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Register | Vote Your Hero</title>
    <style>
        :root {
            color-scheme: light;
            --primary: #3157ff;
            --primary-dark: #1d3fd1;
            --bg: #f4f7fb;
            --card: #ffffff;
            --text: #1f2937;
            --muted: #6b7280;
            --border: #d9e0ea;
            --danger: #b42318;
            --success: #067647;
        }

        * {
            box-sizing: border-box;
        }

        body {
            min-height: 100vh;
            margin: 0;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at top left, rgba(49, 87, 255, 0.18), transparent 34rem),
                var(--bg);
            color: var(--text);
            font-family: Arial, Helvetica, sans-serif;
            padding: 2rem 1rem;
        }

        .register-card {
            width: min(100%, 460px);
            background: var(--card);
            border: 1px solid rgba(217, 224, 234, 0.75);
            border-radius: 24px;
            box-shadow: 0 24px 80px rgba(31, 41, 55, 0.12);
            padding: 2rem;
        }

        .eyebrow {
            color: var(--primary);
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.12em;
            margin: 0 0 0.5rem;
            text-transform: uppercase;
        }

        h1 {
            font-size: clamp(2rem, 5vw, 2.65rem);
            line-height: 1;
            margin: 0 0 0.75rem;
        }

        .intro {
            color: var(--muted);
            margin: 0 0 1.5rem;
        }

        .message {
            border-radius: 14px;
            font-size: 0.95rem;
            margin-bottom: 1rem;
            padding: 0.85rem 1rem;
        }

        .message.success {
            background: #ecfdf3;
            border: 1px solid #abefc6;
            color: var(--success);
        }

        .message.error {
            background: #fef3f2;
            border: 1px solid #fecdca;
            color: var(--danger);
        }

        .message ul {
            margin: 0;
            padding-left: 1.2rem;
        }

        label {
            display: block;
            font-weight: 700;
            margin-bottom: 0.45rem;
        }

        .field {
            margin-bottom: 1rem;
        }

        input[type="text"],
        input[type="email"],
        input[type="password"] {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 12px;
            color: var(--text);
            font-size: 1rem;
            padding: 0.85rem 0.95rem;
            transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(49, 87, 255, 0.14);
            outline: none;
        }

        .terms {
            align-items: flex-start;
            color: var(--muted);
            display: flex;
            font-size: 0.95rem;
            gap: 0.6rem;
            margin: 1.1rem 0 1.4rem;
        }

        .terms input {
            margin-top: 0.2rem;
        }

        button {
            width: 100%;
            background: var(--primary);
            border: 0;
            border-radius: 12px;
            color: #ffffff;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 700;
            padding: 0.95rem 1rem;
            transition: background 160ms ease, transform 160ms ease;
        }

        button:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
        }

        .footnote {
            color: var(--muted);
            font-size: 0.86rem;
            margin: 1rem 0 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <main class="register-card" aria-labelledby="register-title">
        <p class="eyebrow">Vote Your Hero</p>
        <h1 id="register-title">Create account</h1>
        <p class="intro">Register to vote for your favorite hero and keep your account secure.</p>

        <?php if ($successMessage !== ''): ?>
            <div class="message success" role="status"><?= e($successMessage); ?></div>
        <?php endif; ?>

        <?php if ($errors !== []): ?>
            <div class="message error" role="alert">
                <ul>
                    <?php foreach ($errors as $error): ?>
                        <li><?= e($error); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <form method="post" novalidate>
            <input type="hidden" name="csrf_token" value="<?= e($_SESSION['csrf_token']); ?>">

            <div class="field">
                <label for="full_name">Full name</label>
                <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value="<?= e($input['full_name']); ?>"
                    autocomplete="name"
                    required
                >
            </div>

            <div class="field">
                <label for="email">Email address</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value="<?= e($input['email']); ?>"
                    autocomplete="email"
                    required
                >
            </div>

            <div class="field">
                <label for="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    autocomplete="new-password"
                    minlength="8"
                    required
                >
            </div>

            <div class="field">
                <label for="confirm_password">Confirm password</label>
                <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    autocomplete="new-password"
                    minlength="8"
                    required
                >
            </div>

            <label class="terms">
                <input type="checkbox" name="terms" value="1" required>
                <span>I agree to create an account for Vote Your Hero.</span>
            </label>

            <button type="submit">Register now</button>
        </form>

        <p class="footnote">Passwords are stored using PHP password hashing.</p>
    </main>
</body>
</html>
