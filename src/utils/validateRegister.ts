import { UsernamePasswordInput } from "src/resolvers/UsernamePasswordInput";

export const validateRegister = (options: UsernamePasswordInput) => {
    const errorResponse: Array<{ field: string; message: string }> = [];

    if (options.username.length <= 2) {
        errorResponse.push({
            field: "username",
            message: "Length must be greater than 2",
        });
    }

    if (options.username.includes("@")) {
        errorResponse.push({
            field: "username",
            message: "Username cannot contain @",
        });
    }

    if (options.password.length <= 2) {
        errorResponse.push({
            field: "password",
            message: "Length must be greater than 2",
        });
    }

    if (!options.email.includes("@")) {
        errorResponse.push({
            field: "email",
            message: "Invalid email",
        });
    }

    return errorResponse.length > 0 ? errorResponse : null;
};
