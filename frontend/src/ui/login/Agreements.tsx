import React from 'react';

type AgreementCheckboxProps = {
    id: string;
    href: string;
    linkText: string;
};

/** Extrahiert die beiden Zustimmungsfelder in eine einzelne Komponente */
const AgreementCheckbox: React.FC<AgreementCheckboxProps> = ({
    id,
    href,
    linkText,
}) => {
    return (
        <label className='terms'>
            <input type='checkbox' id={id} />
            <span>
                I agree to the{' '}
                <a href={href} target='_blank' rel='noopener noreferrer'>
                    {linkText}
                </a>
            </span>
        </label>
    );
};

export const Agreements: React.FC = () => {
    return (
        <>
            <AgreementCheckbox
                id='privacy-checkbox'
                href='/privacy-policy.html'
                linkText='Privacy Policy'
            />
            <AgreementCheckbox
                id='tos-checkbox'
                href='/terms.html'
                linkText='Terms of Service'
            />
        </>
    );
};
