import { message } from 'antd';

// ---------------------=[ our antd-messages styling ]=--------------------- //

export const showErrMsg = (content: string) => {
    message.error({
        content,
        className: 'app-message app-message-error',
    });
};

export const showSuccessMsg = (content: string) => {
    message.success({
        content,
        className: 'app-message app-message-success',
    });
};
