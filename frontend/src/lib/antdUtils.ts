import { message } from 'antd';
import type { GetProp, MessageArgsProps } from 'antd';

// ---------------------=[ our antd-messages styling ]=--------------------- //

const errorStyles: GetProp<MessageArgsProps, 'styles', 'Return'> = {
    root: {
        backgroundColor: 'rgba(250, 250, 250, 0.6)',
        border: '2px solid #bb3333',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    },
    icon: {
        color: '#952222',
    },
    title: {
        color: '#952222',
        fontWeight: 600,
    },
};

const successStyles: GetProp<MessageArgsProps, 'styles', 'Return'> = {
    root: {
        backgroundColor: 'rgba(250, 250, 250, 0.6)',
        border: '2px solid #95de64',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    },
    icon: {
        color: '#237804',
    },
    title: {
        color: '#237804',
        fontWeight: 600,
    },
};

export const showErrMsg = (content: string) => {
    message.error({
        content,
        styles: errorStyles,
    });
};

export const showSuccessMsg = (content: string) => {
    message.success({
        content,
        styles: successStyles,
    });
};
